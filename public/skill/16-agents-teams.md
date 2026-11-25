# 16. Custom UI: agents and teams

**Read this when:** showing "You're chatting with Ravi", letting the user choose a department for a new chat, or hiding the input while a bot is thinking.
**Needs first:** [06-channels.md](06-channels.md).

## Names for ids

```http
POST {base}/agent-team/
authorization: WIDGET_TOKEN:uuid
{ "user_data": { ... } }
```

```json
{ "agents": { "17": "Ravi", "22": "Meera" }, "teams": { "42": "Sales", "43": "Support" } }
```

Each channel has `assigned_type` (`bot` | `agent` | `team`) and
`assigned_id`; look the id up in the right map. `bot` → show the bot's name
or "Assistant". The socket `assign` event updates these live (chapter 9).

## Choosing a team

widget-info `teams[]` is `[{ id, name }]`. With more than one, let the user
pick before the first message and send it as `channelDetail.team_id`
(chapter 7). With one or none, send `null`. After the first message the
backend owns assignment; don't offer a switch.

## Bot vs human UX

While `assigned_type` is `bot` (or not set yet) show a "thinking" state
after you send, and clear it when the reply arrives or after 10 s. For a
human agent just show the typing indicator from chapter 11.
