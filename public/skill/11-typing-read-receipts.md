# 11. Custom UI: typing indicators and read receipts

**Read this when:** agents should see the user typing, and unread counts should clear when the user reads.
**Needs first:** [09-realtime.md](09-realtime.md).

## Send typing

Emit on the socket. The payload's outer `channel` is the company typing
channel (the entry in widget-info `event_channels` whose name contains
`typing`); the inner one is the conversation.

```js
socket.emit("typing",     { channel: typingEventChannel, data: { action: "typing",     channel: conversationChannel } });
socket.emit("not-typing", { channel: typingEventChannel, data: { action: "not-typing", channel: conversationChannel } });
```

Send `typing` once when the user starts (not on every keystroke) and
`not-typing` on send, clear, or 3 s of silence. Keep a flag so you never
send the same state twice in a row.

## Receive typing

Socket event `Typing` → `{ channel, type: "chat", action }`. Chapter 9.

## Read receipts (clear unread)

When the user is actually looking at a conversation with unread > 0 (tab
visible, chat open, that channel selected):

```http
DELETE {base}/read-receipt/{channel}
authorization: WIDGET_TOKEN:uuid
```

Then set that channel's unread to 0 locally. Debounce by about a second so
scrolling through the list doesn't fire it for every channel.
