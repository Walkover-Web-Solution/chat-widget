# 15. Custom UI: push notifications and proactive messages

**Read this when:** agents or automations send proactive messages ("We have a deal for you") that should show even when no chat is open, or the app is a mobile app that wants OS push.
**Needs first:** [09-realtime.md](09-realtime.md).

## In-app (notification socket)

Notifications come over a **second** socket.io connection to
`{notifications_url}` (Base URLs table in [SKILL.md](SKILL.md)), opened with
the same `jwt_token` and options as the chat socket (chapter 9). Subscribe
it to one channel: `ch-comp-{company_id}.{uuid}` (dot, not hyphen).

```js
const notif = io(notifications_url, { auth: { token: jwt_token }, transports: ["websocket", "polling"], reconnection: true });
notif.on("connect", () => notif.emit("subscribe", { channel: [`ch-comp-${company_id}.${uuid}`] }, () => {}));
```

Notifications arrive as `NewPublish` with `message.type === "notification"`:

| `message.message_type` | Do |
| --- | --- |
| `Message` | A proactive chat message. Show a small preview bubble near your launcher; tapping it opens the chat. |
| `Popup`, `Custom` | A rich notification. `content` holds the title/body/image/CTA; render your own overlay. |

Acknowledge if the event gives you a callback (the third socket.io
argument): call it with the message.

## Mobile OS push (FCM)

Register the device so Hello sends through Firebase when the app is closed:

```http
POST {push_base}/add-user-fcm-token/
authorization: <jwt_token>              (the socket JWT, no widget prefix)

{ "fcm": "<device FCM token>", "user_channel": "ch-comp-12345.9f1c…", "...": "any extra pushConfig" }
```

`{push_base}` is in the Base URLs table in [SKILL.md](SKILL.md). When the OS delivers a push, open the
app on the channel in its payload.
