---
name: hello-chat
description: Adds MSG91 Hello live chat to a website or app. Use whenever the user asks to add live chat, a support widget, a chat bubble, talk to agents, or to build their own chat UI on Hello (custom design, React Native, inside an existing screen). Covers the prebuilt widget (script tag) and the headless route (REST + socket) for custom UIs: sessions, conversations, messages, realtime, attachments, typing, feedback, voice calls, push.
---

# Hello Chat

Hello is MSG91's chat product. A website visitor talks to a bot, a human
agent or a team; Hello's backend decides who answers. One **widget token**
(from the Hello dashboard, Widgets page) identifies the company.

This file is the index of a book. Each chapter is one hosted page. Open
only the chapter you need, when you need it. Links are absolute, so a
chapter works on its own.

**Widget host = the host you fetched this file from** (for example
`https://ctest.msg91.com`). Chapter links below are relative to it, and
`chat-widget.js` lives on it. Never swap it for another host. If a page is
missing, download this index again from the same host.

## Base URLs (the only place they are listed)

Hello has two environments. **Use Test for now.** A widget token works only
in the environment it was created in. Chapters refer to these names in
`{braces}`.

| Name | Test (use this) | Production |
| --- | --- | --- |
| Widget host (`chat-widget.js`, this book) | `https://ctest.msg91.com` | `https://blacksea.msg91.com` |
| `{base}` Hello REST, default until routing-region answers | `https://testapi.phone91.com` | `https://api.phone91.com` |
| `{socket_url}` chat socket, default until routing-region answers | `https://testchat.phone91.com` | `https://chat.phone91.com` |
| `{notifications_url}` push/notification socket | `https://testnotifications.phone91.com` | `https://notifications.phone91.com` |
| `{push_base}` mobile push registration | `https://testpush.phone91.com` | `https://push.phone91.com` |
| WebRTC environment name (chapter 14) | `"test"` | `"prod"` |

`routing-region` may return a different `region_url` / `socket_url` for the
company; those always win over the defaults.

## First decision: which route

| The user wants | Route | Read |
| --- | --- | --- |
| "Add live chat / support chat / a chat bubble" and nothing about design | **A. Prebuilt widget** (10 minutes) | Chapters 1–3 |
| "My own design", "match my app", "React Native", "inside my chat screen", or a feature the widget doesn't expose | **B. Custom UI on Hello infrastructure** | Chapter 4, then 5 → 6 → 7 → 9 (the spine), then only the features they asked for |

Pick A unless the user clearly wants B. Never mix: a custom UI does not
load `chat-widget.js`.

## Chapters

| # | Read this when | Page |
| --- | --- | --- |
| 1 | Install the prebuilt widget, set the token, identify the user | [01-embed-widget.md](01-embed-widget.md) |
| 2 | Open/close/hide the widget from page code, send a message, show a ticket | [02-control-widget.md](02-control-widget.md) |
| 3 | React to widget events on the page (opened, closed, unread count, push) | [03-widget-events.md](03-widget-events.md) |
| 4 | Custom UI: the words and the moving parts (client, channel, message, region) | [04-concepts.md](04-concepts.md) |
| 5 | Custom UI: start a session (region → widget-info → client → JWT), identity verification | [05-session.md](05-session.md) |
| 6 | Custom UI: list conversations and unread counts | [06-channels.md](06-channels.md) |
| 7 | Custom UI: send a message, load history, reply to a message | [07-messages.md](07-messages.md) |
| 8 | Custom UI: render each message type (text, attachment, interactive, feedback, call) | [08-message-types.md](08-message-types.md) |
| 9 | Custom UI: realtime over socket (connect, subscribe, every event) | [09-realtime.md](09-realtime.md) |
| 10 | Custom UI: upload and send files or images | [10-attachments.md](10-attachments.md) |
| 11 | Custom UI: typing indicators and read receipts | [11-typing-read-receipts.md](11-typing-read-receipts.md) |
| 12 | Custom UI: bot greeting and starter questions | [12-greetings.md](12-greetings.md) |
| 13 | Custom UI: CSAT feedback at the end of a chat | [13-feedback.md](13-feedback.md) |
| 14 | Custom UI: voice calls (WebRTC) | [14-calls.md](14-calls.md) |
| 15 | Custom UI: push notifications and launcher previews | [15-push-notifications.md](15-push-notifications.md) |
| 16 | Custom UI: who is assigned (bot, agent, team) | [16-agents-teams.md](16-agents-teams.md) |
| 17 | Something fails: error codes and checks | [17-errors.md](17-errors.md) |
| 18 | Type reference (every object, every field) | [18-types.md](18-types.md) |
| R1 | Worked example: a complete custom UI in plain JavaScript | [recipe-custom-ui.md](recipe-custom-ui.md) |

## Rules that apply everywhere

- **Never invent a widget token.** Ask the user for it. It comes from the
  Hello dashboard. Never print it back in full in a report.
- **Route A: use the script, don't rebuild it.** `chat-widget.js` handles
  iframe, launcher, badge, starter questions, co-browse and push for you.
- **Route B: call Hello's backend, never the widget's iframe.** The widget
  is an app built on the same REST + socket you get. Don't scrape or
  postMessage into it.
- **Order matters in Route B.** Region first, then widget-info, then the
  client, then the JWT, then the socket. Chapter 5 is the only correct
  order.
- **Backend is the source of truth.** Don't guess assignment, routing or
  ticket state on the client; render what the API and socket say.
- **Identity:** anonymous by default. Pass `unique_id` (plus `mail`,
  `number`, `name`) to identify the user. If the company has identity
  verification on, also pass `user_jwt_token`, which the user's **server**
  signs. The browser never holds the signing secret.

## Finished when

- Route A: the launcher shows on the page, a test message gets a reply (bot
  or agent) in the Hello dashboard inbox, and the user's `window.chatWidget`
  calls (if any) work.
- Route B: a new conversation appears in the Hello inbox, an agent reply
  shows up in the custom UI without a refresh, history loads on reopen, and
  unread counts reset when the chat is read.
