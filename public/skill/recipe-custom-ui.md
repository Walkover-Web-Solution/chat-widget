# Recipe: a complete custom UI in plain JavaScript

**Read this when:** you want the whole Route B flow in one file to adapt. About 120 lines, no framework. Every step links to its chapter.
**Needs first:** [04-concepts.md](04-concepts.md). Install `socket.io-client`.

```js
import { io } from "socket.io-client";

const TOKEN = "WIDGET_TOKEN";                       // from the user, never invented
let base = "https://testapi.phone91.com";              // Base URLs table in SKILL.md; replaced by routing-region
let socketUrl, companyId, inboxId, eventChannels = [], uuid, jwt, socket;
const identity = { unique_id: "user-123", mail: "asha@x.com", number: "9198…", name: "Asha" }; // or {}
const userData = Object.fromEntries(Object.entries(identity).filter(([k, v]) => v && k !== "name"));
const subscribed = new Set();

const api = (path, body, method = "POST") =>
  fetch(base + path, {
    method,
    headers: { authorization: uuid ? `${TOKEN}:${uuid}` : TOKEN, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  }).then(r => (r.ok ? r.json() : r.json().then(e => { throw new Error(e.message || r.status); })));

// ---- 05-session.md ----
export async function start() {
  const region = await api("/routing-region/", { user_data: userData }).catch(() => null);
  if (region?.region_url) { base = region.region_url; socketUrl = region.socket_url; }
  socketUrl ||= "https://testchat.phone91.com";       // default from the Base URLs table

  const info = await api("/widget-info/", { user_data: userData });
  companyId = info.company_id; inboxId = info.inbox_id; eventChannels = info.event_channels || [];

  let channels = [];
  const stored = localStorage.getItem("hello_uuid");
  if (!stored && !identity.unique_id && !identity.mail && !identity.number) {
    uuid = (await api("/anonymous-client-details/", {})).data.uuid;
  } else {
    uuid = stored || undefined;
    const list = await api("/pubnub-channels/list/", { ...identity, user_data: userData });
    uuid = list.uuid; channels = list.channels || [];
  }
  localStorage.setItem("hello_uuid", uuid);

  jwt = (await api("/jwt-token/", null, "GET")).data.jwt_token;
  connect(channels);
  return channels;
}

// ---- 09-realtime.md ----
function connect(channels) {
  socket = io(socketUrl, { auth: { token: jwt }, transports: ["websocket", "polling"], reconnection: true });
  [`ch-comp-${companyId}-${uuid}`, ...channels.map(c => c.channel), ...eventChannels].forEach(c => subscribed.add(c));
  socket.on("connect", () => socket.emit("subscribe", { channel: [...subscribed] }, () => {}));
  socket.on("connect_error", async () => { jwt = (await api("/jwt-token/", null, "GET")).data.jwt_token; socket.auth.token = jwt; socket.connect(); });
  socket.on("NewPublish", ({ response }) => {
    const m = response.message; if (!m?.new_event) return;
    const mine = !!m.chat_id && (!m.client_sender_id || m.client_sender_id === uuid);
    if (m.type === "chat") render(m.channel, { ...m, id: response.id || m.id || response.timetoken }, mine);
    if (m.type === "feedback") render(m.channel, m, false);
    if (m.type === "new-channel") subscribe([m.channel]);
    if (m.type === "update" && m.client_id) { uuid = m.client_id; localStorage.setItem("hello_uuid", uuid); subscribe([`ch-comp-${companyId}-${uuid}`]); }
  });
  socket.on("Typing", ({ channel, action }) => showTyping(channel, action === "typing"));
}
function subscribe(list) { list.forEach(c => subscribed.add(c)); if (socket.connected) socket.emit("subscribe", { channel: list }, () => {}); }

// ---- 07-messages.md ----
let chatId = null, channel = null;
export async function send(text, attachments = null) {
  const widget_msg_id = Math.random().toString(36).slice(2, 10);
  render(channel, { id: widget_msg_id, content: { text, attachment: attachments }, message_type: "text" }, true); // optimistic
  let channelDetail;
  if (!chatId) {
    channel = `ch-comp-${companyId}.${crypto.randomUUID().replace(/-/g, "")}`;
    subscribe([channel]);
    channelDetail = { new: true, channel_hex: channel, uuid, unique_id: identity.unique_id, team_id: null,
      customer_name: identity.name || null, customer_mail: identity.mail || null, customer_number: identity.number || null,
      pseudo_name: identity.name ? false : null, call_enabled: null, country: null, country_iso2: null, is_blocked: null, chatInputSubmitted: false };
  }
  const { data } = await api("/v2/send/", {
    type: "widget", message_type: attachments ? (text ? "text-attachment" : "attachment") : "text",
    content: { text, attachment: attachments }, chat_id: chatId, widget_msg_id,
    ...(channelDetail && { channelDetail }), user_data: userData, sessionVariables: {},
  });
  chatId = data.id; channel = data.channel;
  subscribe([data.presence_channel, data.channel].filter(Boolean));
}

export async function history(ch, startFrom = 1) {
  const { data } = await api("/get-history/", { channel: ch, origin: "chat", page_size: 30, start_from: startFrom, user_data: userData });
  return data; // newest first; each { id, timetoken, message }
}

// ---- 10-attachments.md ----
export async function upload(file) {
  const fd = new FormData(); fd.append("attachment", file);
  const r = await fetch(`${base}/v2/upload/?type=chat&inbox_id=${inboxId}`, { method: "POST", headers: { authorization: `${TOKEN}:${uuid}` }, body: fd });
  return (await r.json()).data[0];
}

// ---- 11-typing-read-receipts.md ----
const typingChannel = () => eventChannels.find(c => c.includes("typing"));
export const typing = on => socket.emit(on ? "typing" : "not-typing", { channel: typingChannel(), data: { action: on ? "typing" : "not-typing", channel } });
export const markRead = ch => api(`/read-receipt/${ch}`, null, "DELETE");

// your UI
function render(ch, message, mine) { /* 08-message-types.md */ }
function showTyping(ch, on) {}
```

## Finished when

- `start()` resolves, the Hello inbox shows the visitor (anonymous or by name)
- `send("hi")` creates a ticket in the inbox; an agent reply calls `render` without a refresh
- Reload → `history(channel)` returns the same messages
- `markRead` clears the unread badge in the dashboard
