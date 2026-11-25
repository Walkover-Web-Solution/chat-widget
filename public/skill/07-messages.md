# 7. Custom UI: messages

**Read this when:** sending a message, loading history, replying to a message, showing "read more".
**Needs first:** [05-session.md](05-session.md), [06-channels.md](06-channels.md). For live replies also [09-realtime.md](09-realtime.md).
**Finished when:** a sent message shows in the Hello inbox and the reply arrives over the socket.

## Send

```http
POST {base}/v2/send/
authorization: WIDGET_TOKEN:uuid

{
  "type": "widget",
  "message_type": "text",
  "content": { "text": "Hi, I need help with my order", "attachment": null },
  "chat_id": 917068,
  "widget_msg_id": "a1b2c3d4",
  "replied_on": null,
  "user_data": { ... },
  "sessionVariables": {}
}
```

| Field | Rule |
| --- | --- |
| `type` | Always `"widget"`. |
| `message_type` | `text`; `attachment` (files, no text); `text-attachment` (both); `voice_call` (chapter 14). |
| `content.text` | The text. Empty string when attachment only. |
| `content.attachment` | `null` or an array of upload results (chapter 10). |
| `chat_id` | The channel's `id` for an existing chat. `null` for a new chat (then add `channelDetail`, below). |
| `widget_msg_id` | Your own short random id. The socket echo of your message carries it so you can replace the optimistic bubble. |
| `replied_on` | Message id being replied to, or omit. |
| `sessionVariables` | Key/values for the bot (same as `variables` in the widget). `{}` if none. |

Response:

```json
{ "data": { "id": 917068, "channel": "ch-comp-12345.9d3f…", "presence_channel": "presence-…", "uuid": "9f1c…" } }
```

`id` is the `chat_id` for every later message in this conversation.

### New chat

No `chat_id`, and add `channelDetail`. Propose your own channel id so you can
subscribe before sending and not miss a fast bot reply:

```js
const hex = crypto.randomUUID().replace(/-/g, "");
const channel = `ch-comp-${company_id}.${hex}`;
await socket.subscribe([channel]);           // chapter 9; give up after 2 s and send anyway
```

```json
{
  "type": "widget", "message_type": "text",
  "content": { "text": "Hi", "attachment": null },
  "chat_id": null,
  "channelDetail": {
    "new": true,
    "channel_hex": "ch-comp-12345.<hex>",
    "uuid": "9f1c…",
    "unique_id": "user-123",
    "team_id": 42,
    "customer_name": "Asha Rao", "customer_mail": "asha@x.com", "customer_number": "9198…",
    "pseudo_name": false,
    "presence_channel": "presence-…",
    "call_enabled": null, "country": null, "country_iso2": null, "is_blocked": null,
    "chatInputSubmitted": false
  },
  "user_data": { ... }, "sessionVariables": {}
}
```

- `team_id`: from widget-info `teams`. Required only when there is more than
  one team; otherwise `null`.
- `customer_*`: what you know; `null` otherwise. `pseudo_name: false` only
  when `customer_name` is the real name.
- The response `channel` normally equals your `channel_hex`. If it differs,
  unsubscribe yours and subscribe the returned one.
- After the response: save `uuid` (anonymous users get their real client
  uuid here), subscribe `[presence_channel, channel]`, and refresh the
  channel list.

### Optimistic UI

Append the user's bubble immediately. When the socket `chat` event arrives
with your `widget_msg_id` (or `chat_id` set and `client_sender_id` = your
uuid), replace the bubble with the server copy (it carries the real `id` and
`timetoken`).

## History

```http
POST {base}/get-history/
authorization: WIDGET_TOKEN:uuid

{ "channel": "ch-comp-12345.9d3f…", "origin": "chat", "page_size": 30, "start_from": 1, "user_data": { ... } }
```

```json
{ "data": [
  { "id": "6878a2ea…", "timetoken": 17210000000000000,
    "message": { "type": "chat", "message_type": "text",
                 "content": { "text": "Hello!", "attachment": null, "show_more": false },
                 "chat_id": 917068, "channel": "ch-comp-12345.9d3f…",
                 "sender_id": "bot", "from_name": "Hello Bot", "is_auto_response": true,
                 "client_sender_id": null, "message_id": "6878a2ea…",
                 "replied_msg_content": null, "replied_from_name": null } }
] }
```

- Newest first. Page with `start_from = loaded + 1`, 30 per page; stop when
  a page returns fewer than 30.
- Who sent it: `message.chat_id` set and (`client_sender_id` missing or
  equal to your uuid) → the user; `sender_id` is `bot`/`workflow` or
  `is_auto_response` → bot; otherwise a human agent (`from_name`).
- `timetoken / 10000` = milliseconds since epoch.
- Rendering per `message_type`: [08-message-types.md](08-message-types.md).

### Read more (long messages)

If `content.show_more === true`, the text is a preview. Fetch the rest on tap:

```http
POST {base}/get-history/
{ "channel": "ch-comp-…", "message_id": "6878a2ea…", "origin": "chat", "user_data": { ... } }
```

```json
{ "message": { "text": "…full text…", "attachment": null } }
```

## Reply to a message

Send with `"replied_on": "<message id>"`. Incoming messages that are replies
carry `replied_msg_content`, `replied_msg_type`, `replied_from_name`,
`replied_msg_sender_id` so you can draw the quote block.

## Checklist

- [ ] first message of a new chat: subscribed before sending, `chat_id` saved from the response
- [ ] later messages: `chat_id` set, no `channelDetail`
- [ ] optimistic bubble replaced by the socket echo, not duplicated
- [ ] history paged newest-first, `show_more` handled
