# 17. Errors and checks

**Read this when:** something returns non-2xx, the socket won't connect, or the widget vanished.

Every error body looks like `{ "message": "…" }` (sometimes nested under
`data`). Show `message` to the user when it is human-readable.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Prebuilt widget never appears; console shows `initializeHelloChat_failed` | Wrong widget token, widget disabled, or `widget-info` blocked | Check the token in the Hello dashboard. Open `https://<region>/widget-info/` in devtools: 401/403 = token. |
| `Could not detect chat-widget script` | Script loaded without a `src` (inlined) | Load it by URL. |
| `widget-info` 401/403 | Token wrong or from the other environment | A production token needs production URLs, a test token needs test URLs (Base URLs table in [SKILL.md](SKILL.md)). |
| `pubnub-channels/list` 401/403 with `unique_id` | Identity verification is on and `user_jwt_token` missing/invalid | Get the token from the user's server (chapter 5). Fall back to anonymous meanwhile. |
| Socket `connect_error` | JWT expired or from before a region change | `GET /jwt-token/` again, reconnect. |
| Replies never arrive but history shows them | Not subscribed to the channel, or subscription lost on reconnect | Replay `subscribe` on `connect` (chapter 9). |
| Bot reply missing for the first message of a new chat | Subscribed after sending | Subscribe to your proposed `channel_hex` before `POST /v2/send/`. |
| Upload 4xx | Type/size not allowed by the inbox | Show `message`, drop the file. |
| `region_url` differs from the host you were using | Company lives in another region | Switch base and reconnect the socket. Always run routing-region first. |
| Calls: `WebRTC not initialized` | Client token fetched before uuid existed, or `voice_call_widget` false | Order from chapter 14. |

## Quick health check (curl)

```bash
curl -s -X POST {base}/routing-region/ \
  -H "authorization: $WIDGET_TOKEN" -H "content-type: application/json" -d '{"user_data":{}}'
```

A JSON body with `region_url` means the token is good and the network path
is open. Anything else: fix that before touching UI code.

## Reporting a problem to MSG91

Include: widget token's first 4 characters, `company_id`, the failing
endpoint, the response `message`, and the time (IST). Never paste the full
token or any JWT.
