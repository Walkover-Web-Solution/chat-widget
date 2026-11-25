# 14. Custom UI: voice calls

**Read this when:** widget-info `voice_call_widget` is true and the user wants a call button, or incoming calls from agents.
**Needs first:** [05-session.md](05-session.md), [09-realtime.md](09-realtime.md).
**Finished when:** a call started from your UI rings an agent in the Hello dashboard, and a call summary message appears in the chat afterwards.

Calls use WebRTC through MSG91's client library. Install `msg91-webrtc-call`.

## 1. Client token (once per session)

```http
GET {base}/web-rtc/get-client-token/
authorization: WIDGET_TOKEN:uuid
```

```json
{ "data": { "jwt_token": "eyJ…" } }
```

```js
import WebRTC from "msg91-webrtc-call";
const rtc = WebRTC(jwt_token, "test");       // "prod" in production (Base URLs table in SKILL.md)
rtc.on("call", (call) => { /* incoming or outgoing, see below */ });
```

## 2. Start a call

Ask for microphone permission first (`navigator.mediaDevices.getUserMedia({ audio: true })`).
Then send a `voice_call` message into the conversation; the response carries
the call token:

```json
{ "type": "widget", "message_type": "voice_call",
  "content": { "text": "", "attachment": null },
  "chat_id": 917068, "user_data": { ... }, "sessionVariables": {} }
```

```json
{ "data": { "id": 917068, "channel": "ch-comp-…", "call_jwt_token": "eyJ…" } }
```

```js
await rtc.call(call_jwt_token);
```

For a new conversation, include `channelDetail` as in chapter 7.

## 3. Call object events

`rtc.on("call", call)` fires for both directions. `call.type === "incoming-call"`
means an agent is calling: show Accept/Reject.

| Call event | Meaning |
| --- | --- |
| `ringing` | Outgoing: waiting for an agent. |
| `connected` | Audio is flowing. Start a timer. |
| `ended`, `hangup` | Over. Reset UI. |
| `rejoined` | After a reload with `rtc.rejoinCall(callId)`. |
| `mute` / `unmute` | Mute state changed (`call.mute()`, `call.unmute()`). |

Controls: `call.accept()`, `call.reject()` (or `call.hang()`), `call.hang()`.

One call at a time. Disable the button while state isn't idle.

## 4. After the call

A `chat` socket event with `message_type: "voice_call"` and
`content.status` `completed` or `no_answer` arrives. Render the summary
card (chapter 8) and, if the channel is open, reload history.

## Rejoin after reload

Store the active `call.id` in sessionStorage while connected; on load, if it
exists, `rtc.rejoinCall(id)` and clear it on `ended`.
