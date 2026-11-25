# 13. Custom UI: CSAT feedback

**Read this when:** an agent closes a chat and a rating card arrives (`type: "feedback"`).
**Needs first:** [08-message-types.md](08-message-types.md).

## The incoming card

A `feedback` message carries `token`, `id`, `dynamic_values` (e.g.
`{ "agent_name": "Ravi" }`) and, if already answered, `rating` and
`feedback_msg`. The prompt text is widget-info `feedback_text` with
`{{agent_name}}`-style placeholders replaced from `dynamic_values`.

Ratings are one of: `terrible`, `bad`, `ok`, `good`, `amazing`.

## Submit

```http
POST {base}/receive-feedback/
authorization: WIDGET_TOKEN:uuid

{ "type": "post-feedback", "token": "<message.token>", "id": <message.id>,
  "rating": "good", "feedback_msg": "Quick and helpful", "user_data": { ... } }
```

After a 2xx, store `rating` and `feedback_msg` on that message locally so
the card shows as answered, even after reload (history returns them too).
Disable the card once answered.
