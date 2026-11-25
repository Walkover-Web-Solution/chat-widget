# 4. Custom UI: concepts

**Read this when:** you are building your own chat UI on Hello (Route B). Read once, then go to [05-session.md](05-session.md).
**Needs first:** a widget token from the user.

Hello gives you a REST API and a socket. You own every pixel. The prebuilt
widget is just one app built on the same two things.

## The words

| Word | Meaning |
| --- | --- |
| **Widget token** | Identifies the company (and which inbox, bot and teams apply). Sent as the `authorization` header. |
| **Client** | The end user of your UI. Has a `uuid` issued by Hello. Anonymous until you pass `unique_id`. |
| **Region** | Hello runs in several regions. `POST /routing-region/` tells you the `region_url` (REST base) and `socket_url` for this company. Everything after goes there. |
| **Channel** | One conversation. Its id looks like `ch-comp-<company_id>.<hex>`. In the dashboard it is a ticket; `chat_id` (a number) is its ticket id. |
| **Message** | One item in a channel. Has `type` (`chat`, `feedback`, `assign`...) and `message_type` (`text`, `attachment`, `interactive`, `voice_call`...). |
| **Assignee** | Who answers: `bot`, an `agent` or a `team`. The backend decides; you only display it. |
| **Presence channel** | A per-client socket channel for events that are not tied to one conversation. |
| **Event channels** | Company-wide socket channels from widget-info (typing lives here). |
| **JWT** | Short token from `GET /jwt-token/`, used only to open the socket. |
| **Identity verification** | Optional. The company's server signs a JWT about the user; you pass it as `user_jwt_token`. Proves `unique_id` wasn't spoofed. |

## The shape of a session

```
POST /routing-region/        → region_url, socket_url      (auth: TOKEN)
POST /widget-info/           → company_id, bot, teams...    (auth: TOKEN)
POST /anonymous-client-details/  or  POST /pubnub-channels/list/
                             → client uuid (+ channels)     (auth: TOKEN or TOKEN:uuid)
GET  /jwt-token/             → jwt_token                    (auth: TOKEN:uuid)
socket.io connect(socket_url, { auth: { token: jwt_token } })
emit "subscribe" { channel: [personal, ...channels, ...event_channels] }
```

Then: send with `POST /v2/send/`, load with `POST /get-history/`, and
listen to `NewPublish` on the socket for everything that happens.

## Two headers, always

```
authorization: <WIDGET_TOKEN>                 before you have a client uuid
authorization: <WIDGET_TOKEN>:<CLIENT_UUID>   after
content-type: application/json
```

## One body field, always

Every POST/PUT body carries `user_data`: the identity you were given, minus
empty values and minus `name`.

```json
"user_data": { "unique_id": "user-123", "mail": "a@b.com", "number": "9198...", "user_jwt_token": "..." }
```

Anonymous: `"user_data": {}`.

## Store exactly three things

| Key | Value | Lifetime |
| --- | --- | --- |
| `WidgetId` | the widget token | app |
| client uuid | from anonymous-client-details or channel list | until logout |
| region urls | from routing-region | memory only, re-resolve on every start |

Nothing else needs persisting. History, channels and assignment come from
the API every time.
