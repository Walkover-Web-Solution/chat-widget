# 9. Custom UI: realtime (socket)

**Read this when:** you need replies, typing, assignment changes and new conversations to show up live.
**Needs first:** [05-session.md](05-session.md) (you have `socket_url`, `company_id`, uuid, `jwt_token`).
**Finished when:** an agent reply typed in the Hello dashboard appears in your UI within a second, and still does after you kill and restore the network.

Transport is **socket.io** (v4 client). Install `socket.io-client`.

## Connect

```js
import { io } from "socket.io-client";

const socket = io(socket_url, {
  auth: { token: jwt_token },
  transports: ["websocket", "polling"],
  reconnection: true,
  timeout: 20000,
});
```

`jwt_token` is from `GET /jwt-token/`. If the region changes (you re-ran
routing-region and got a different `socket_url`), disconnect and connect
again with the same token.

## Subscribe

Right after `connect`, and again on every reconnect:

```js
const channels = [
  `ch-comp-${company_id}-${uuid}`,          // personal channel (hyphen)
  ...channelList.map(c => c.channel),       // every conversation
  ...widgetInfo.event_channels,             // company events, incl. typing
];
socket.emit("subscribe", { channel: channels }, (ack) => { /* ok */ });
```

Unsubscribe the same way: `socket.emit("unsubscribe", { channel: [...] })`.

Keep your own list of subscribed channels and replay it on
`socket.on("connect")`; the server does not remember subscriptions across
reconnects. On reconnect also refresh history for the open channel, since
messages sent while offline are not replayed.

## Events you receive

### `NewPublish`

Everything that happens in a channel. Payload:

```json
{ "response": { "id": "6878…", "timetoken": 1721…, "company_id": 12345,
                "message": { "type": "chat", "new_event": true, "channel": "ch-comp-…", "...": "..." } } }
```

Switch on `response.message.type`. Only act when `message.new_event === true`
(the same event may be re-delivered as a sync without it).

| `message.type` | Do |
| --- | --- |
| `chat` | A message in `message.channel`. If it is **yours** (`chat_id` set and `client_sender_id` missing or = your uuid): replace the optimistic bubble. Else: append it, stop the typing indicator, play a sound, bump unread for that channel if it isn't on screen, move the channel to the top, set `is_closed = false`. For `message_type: "voice_call"` only show it when `content.status` is `completed`, `no_answer` or `in-progress`. |
| `feedback` | Append the rating card (chapter 13) and mark the channel closed. |
| `assign` | `message.assignee_type` (`bot`/`agent`/`team`), `message.assignee_id`, `message.channel_details.channel`. Update the header ("You're chatting with …"). |
| `new-channel` | A conversation was opened for this client from elsewhere. Fields: `channel`, `chat_id`, `ticket_id`, `customer_name`, `last_message`, `widget_unread_count`, `created_at`, `current` (`"closed"` or not). Add it to the list, subscribe `message.channel`, then re-fetch the channel list to fill in assignment. |
| `update` | `message.client_id`: your client uuid changed (e.g. merged). Store the new uuid, unsubscribe `message.channel`, subscribe `ch-comp-${company_id}-${client_id}`. |
| `block` | Peer chats only: `message.value` true/false toggles `is_blocked` on `message.channel`. |
| `notification` | Push/proactive messages; see [15-push-notifications.md](15-push-notifications.md). |

Message rendering: [08-message-types.md](08-message-types.md). The message
id to store is `response.id` (fallback `response.message.id`, then
`response.timetoken`).

### `Typing`

```json
{ "channel": "ch-comp-…", "type": "chat", "action": "typing" }
```

`action` is `typing` or `not-typing`. Show "Agent is typing…" on that
channel. Also auto-hide after a few seconds in case `not-typing` is lost.
Sending your own typing state: [11-typing-read-receipts.md](11-typing-read-receipts.md).

## Lifecycle

| Socket event | Do |
| --- | --- |
| `connect` | Re-emit `subscribe` with your full list. Flush anything you queued while offline. |
| `disconnect` | Show an "offline" hint if it lasts more than a couple of seconds. |
| `connect_error` | Usually a bad/expired JWT. Fetch `GET /jwt-token/` again and reconnect with the new token. |
| `io.on("reconnect")` | Refresh history of the open channel and the channel list. |

## Checklist

- [ ] `subscribe` replayed on every `connect`
- [ ] own messages detected by `client_sender_id`, not by `chat_id` alone
- [ ] `new_event` checked before acting
- [ ] `connect_error` → new JWT → reconnect
