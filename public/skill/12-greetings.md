# 12. Custom UI: bot greeting and starter questions

**Read this when:** the company has a bot and you want its opening line and quick-reply options before the first message.
**Needs first:** [05-session.md](05-session.md) (`company_id`, `bot_id`, `bot_type` from widget-info, and a client uuid).

Only when `bot_type` is `lex` or `chatgpt`.

```http
# bot_type === "lex"
POST {base}/chat-bot/welcome/get-welcome/
authorization: WIDGET_TOKEN:uuid
{ "company_id": 12345, "bot_id": "b-1" }

# bot_type === "chatgpt"
GET {base}/chat-gpt/greeting/?company_id=12345&bot_id=b-1
authorization: WIDGET_TOKEN:uuid
```

```json
{ "data": { "greeting": { "text": "Hi! How can I help?", "options": [ "Track my order", "Talk to a human" ] } } }
```

Show `greeting.text` as the first bot bubble and `options` as tappable
chips, but only when the user has no conversations yet (channel list empty,
or one entry with `id: null`). Tapping a chip sends its text as a normal
message and starts the chat. Hide the greeting once a real conversation
exists.
