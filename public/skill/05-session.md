# 5. Custom UI: start a session

**Read this when:** first thing in Route B. Every other chapter assumes this ran.
**Needs first:** [04-concepts.md](04-concepts.md).
**Finished when:** you hold `region_url`, `socket_url`, `company_id`, a client `uuid` and a `jwt_token`.

`{base}` starts as the default REST URL from the Base URLs table in
[SKILL.md](SKILL.md) (production or test, matching the token). Any regional
host answers `/routing-region/` for any company, so the default only has to
be right for step 1.

Run the steps in this order. Each depends on the one before.

## Step 1: region

```http
POST {base}/routing-region/
authorization: WIDGET_TOKEN
content-type: application/json

{ "user_data": {} }
```

```json
{ "region_url": "https://api.phone91.com", "socket_url": "https://chat.phone91.com",
  "country": "IN", "company_id": 12345, "inbox_id": 678 }
```

Use `region_url` as `{base}` from here on, and `socket_url` in chapter 9.
Keep both in memory only. If this call fails, continue with the default
base; it is non-fatal.

## Step 2: widget-info

```http
POST {base}/widget-info/
authorization: WIDGET_TOKEN

{ "user_data": {} }
```

Returns the company's widget settings. Fields you will use:

| Field | Use |
| --- | --- |
| `company_id`, `inbox_id` | Needed for channel names and uploads. |
| `bot_id`, `bot_type` (`lex` \| `chatgpt`) | For greetings (chapter 12). |
| `teams[]` `{ id, name }` | Let the user pick a team for a new chat when more than one (chapter 16). |
| `event_channels[]` | Socket channels to subscribe to (chapter 9). The one containing `typing` is the typing channel. |
| `voice_call_widget` | Calls are on (chapter 14). |
| `primary_color`, `logo`, `tagline` | Branding, if you want to honour the dashboard. |
| `show_widget_form` | Company wants name/email/phone before the first message. |
| `feedback_text` | CSAT prompt template (chapter 13). |
| `hide_launcher`, `launch_widget` | Only meaningful for the prebuilt widget. |

A non-2xx here means the token is wrong or the widget is disabled. Stop and
tell the user (chapter 17).

## Step 3: the client

Decide: does the user have identity (`unique_id`, `mail` or `number`)?

**No identity and no stored uuid: register anonymous.**

```http
POST {base}/anonymous-client-details/
authorization: WIDGET_TOKEN

{}
```

```json
{ "data": { "uuid": "9f1c…" } }
```

Store `uuid`. Later, when the user sends the first message, the channel list
call below will return the same uuid.

**Identity, or a stored uuid: call the channel list.** It both resolves the
client and returns conversations.

```http
POST {base}/pubnub-channels/list/
authorization: WIDGET_TOKEN            (or WIDGET_TOKEN:uuid if you have one)

{ "name": "Asha", "mail": "asha@x.com", "number": "9198…", "unique_id": "user-123",
  "user_data": { "unique_id": "user-123", "mail": "asha@x.com", "number": "9198…" } }
```

```json
{ "uuid": "9f1c…", "channels": [ ... ], "customer_name": "Asha", "pseudo_name": false,
  "customer_mail": "asha@x.com", "customer_number": "+9198…", "call_enabled": true,
  "presence_channel": "presence-…", "country": "India", "city": "…", "region": "…", "ip": "…" }
```

Store `uuid`. `channels` is described in [06-channels.md](06-channels.md).

**Merging an anonymous chat into a login.** On the first identified call for
a user, add `"anon_client_uuid": "<the anonymous uuid you stored>"` to the
body. Hello moves the anonymous conversations onto the identified client.
Send it once; after that drop it.

**Logout.** Forget the uuid and the identity, call anonymous-client-details
again. Do not reuse the identified uuid for a different user.

## Step 4: socket JWT

```http
GET {base}/jwt-token/
authorization: WIDGET_TOKEN:uuid
```

```json
{ "data": { "jwt_token": "eyJ…" } }
```

Hand it to [09-realtime.md](09-realtime.md). Fetch a fresh one on every app
start; do not persist it.

## Step 5 (optional): contact details and custom fields

Anything you know about the user that agents should see:

```http
PUT {base}/v2/client/{uuid}
authorization: WIDGET_TOKEN:uuid

{ "Name": "Asha Rao", "Email": "asha@x.com", "Phonenumber": "9198…",
  "plan": "pro", "company": "Acme", "user_data": { ... } }
```

`Name`, `Email`, `Phonenumber` are the three standard fields (capitalised
exactly so). Every other key becomes a custom field. Response `data` echoes
the stored contact; if `Name`, `Email` or `Phonenumber` is missing you may
want to show a contact form before the first message (the prebuilt widget
does when `show_widget_form` is true).

## Identity verification (`user_jwt_token`)

If the company enabled it, Hello refuses to trust `unique_id` unless a JWT
signed with the company's secret proves it.

- The **user's server** signs: `{ "unique_id": "...", "mail": "...", "number": "..." }`
  (the same values you send) with the secret from the Hello dashboard, HS256.
- Your UI receives that token from its own backend and puts it in
  `user_data.user_jwt_token` on every call (it is part of `user_data`, so
  nothing else changes).
- Never ship the secret to the browser. If the user asks you to "just sign
  it in the frontend", refuse and explain: that makes anyone able to open
  anyone's chats.

Without the token on a verification-enabled company the channel list call
fails with 401/403; fall back to anonymous and tell the user why.

## Page tracking and user events (optional)

Agents see which pages the visitor saw and what they did:

```http
PUT {base}/add-domain/
authorization: WIDGET_TOKEN:uuid

{ "dom": "https://shop.example.com/cart", "user_data": { ... },
  "event_data": { "event": "cart_abandoned", "value": 4999 } }
```

Send `dom` on route change, `event_data` when something happens. Both
optional, failures are non-fatal.

## Checklist

- [ ] routing-region ran first and `{base}` switched to `region_url`
- [ ] widget-info 2xx; `company_id` and `event_channels` saved
- [ ] client uuid saved; header is now `TOKEN:uuid`
- [ ] jwt_token fetched after the uuid existed
- [ ] identity verification: token comes from the user's server, never signed in the UI
