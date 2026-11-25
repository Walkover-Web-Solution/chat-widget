# 6. Custom UI: conversations (channels)

**Read this when:** you show a list of past chats, unread badges, or need to know which channel to send into.
**Needs first:** [05-session.md](05-session.md) (you have a uuid).
**Finished when:** the list renders, the newest conversation is on top, unread counts match the dashboard.

## List

Same call as in step 3 of the session chapter. Call it on start, after
every first message of a new chat, and whenever the socket says `new-channel`.

```http
POST {base}/pubnub-channels/list/
authorization: WIDGET_TOKEN:uuid

{ "unique_id": "...", "mail": "...", "number": "...", "name": "...", "user_data": { ... } }
```

Response `channels[]`, each:

| Field | Meaning |
| --- | --- |
| `id` | Ticket id (number). This is the `chat_id` you send messages with. `null` means "a draft, nothing sent yet". |
| `channel` | Socket/channel id, `ch-comp-<company>.<hex>`. Used for history, subscribe, read receipts. |
| `assigned_type` | `bot`, `agent` or `team`. |
| `assigned_id`, `assigned_to`, `team_id` | Who. Names come from [16-agents-teams.md](16-agents-teams.md). |
| `is_closed` | Conversation closed by agent; a new message reopens it. |
| `widget_unread_count` | Unread for this client. Show this one. (`cc_unread_count` is the agent side.) |
| `last_message` | `{ message, timetoken }` for the preview line. `timetoken` is in 10^-7 s units (PubNub style); divide by 10,000 for ms. |
| `total_message_count` | Size, for "load more" decisions. |
| `is_peer_channel`, `channel_peers[]`, `is_blocked` | Widget-to-widget chats (two end users). Usually ignore. |

Also on the response root: `uuid`, `customer_name` (a generated pseudo name
unless `pseudo_name === false`), `customer_mail`, `customer_number`,
`call_enabled`, `presence_channel`.

## Order and unread

- Sort by `last_message.timetoken` descending. When a socket `chat` event
  arrives for a channel, move it to the top.
- Increment the unread count on an incoming message that is not yours
  (`message.chat_id` set and `client_sender_id` ≠ your uuid means it is
  yours; see [09-realtime.md](09-realtime.md)).
- Reset it when the user is looking at the channel: call the read receipt
  delete in [11-typing-read-receipts.md](11-typing-read-receipts.md).

## Which channel do I send to?

- Continuing a chat: use that channel's `id` as `chat_id`.
- New chat: no `chat_id`; you propose a channel id. See
  [07-messages.md](07-messages.md).

## Subscribe

After the list, subscribe the socket to every `channels[].channel` plus your
personal channel `ch-comp-<company_id>-<uuid>` (hyphen, not dot) plus
`event_channels` from widget-info. Chapter 9 has the call.
