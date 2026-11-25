# Hello Chat Skill — Brainstorm

**Date:** 2026-11-20
**Status:** Decided 2026-11-20 (see Decisions). Phase 1 written in `public/skill/`.
**Branch:** `feat/hello-widget-skill`

## What we are building

One **skill** (a folder with `SKILL.md`, installable with `npx skills add`) that lets any AI agent
(Claude Code, Cursor, Codex, ChatGPT) do two jobs for a customer:

1. **Drop in** the ready-made Hello chat widget (script tag + `window.chatWidget`).
2. **Build their own UI** on top of Hello's infrastructure (auth, tickets, messages, realtime,
   files, calls, feedback, push) without touching our widget at all.

Both jobs are written as a **book**: a tiny index the agent always reads, plus one chapter per
feature that the agent opens only when it needs it. This is the same shape as the Embarko skill
(`Embarko/skill/SKILL.md`): the skill file is ~100 lines, everything else is a hosted `.md` URL.

## Why a book

- Agents have small context. A 3,000-line skill gets skimmed and misread. A 100-line index with
  links gets followed.
- One copy of truth. Chapters are hosted; fixing a chapter fixes every installed skill.
- Agents only pay for what they use. A customer who only wants the prebuilt widget never loads
  the socket chapter.

## The two routes (first decision the agent makes)

| Route | When | What the agent reads |
| --- | --- | --- |
| **A. Prebuilt widget** | Customer says "add Hello chat / add live chat" and does not mention custom design | Chapters 1–3 only |
| **B. Custom UI (headless)** | Customer says "my own design", "match my app", "React Native", "inside my existing chat screen", or asks for a feature our widget doesn't expose | Chapter 4 (concepts) + only the feature chapters they need |

The index tells the agent to pick A unless the customer clearly wants B. A is ten minutes; B is a
project.

## Key design call: headless SDK, not raw HTTP

For Route B there are two ways to "give the infrastructure":

| Option | Pros | Cons |
| --- | --- | --- |
| **Raw REST + socket docs** | Nothing new to ship | Every agent re-implements region routing, JWT refresh, socket.io events, channel bookkeeping, read receipts. Each one slightly wrong. |
| **Headless core package** (`@msg91/hello-chat` or similar: framework-free JS, optional React hooks) | One tested implementation; chapters become "call this function"; same package our own widget can use later | We ship and maintain a package |

**Recommendation: headless core.** This mirrors Embarko's rule "don't replace `deploy.sh` with your
own `tar`/`curl`". The chapters still show the underlying HTTP/socket contract for agents on
platforms where npm isn't available (plain `<script>`, mobile), but the primary path is the package.

The package is extracted from what already exists in this repo: `config/helloApi.ts`,
`config/regionConfig.ts`, `hooks/socketManager.js`, `hooks/socketEventHandler.ts`,
`utils/helloInterceptor.ts`. No new backend.

## Book outline (feature inventory from the code)

Each chapter is one hosted `.md` with the same skeleton (see "Chapter template").

| # | Chapter | Source in this repo |
| --- | --- | --- |
| 0 | **Index / how to read this book** (the `SKILL.md` itself) | — |
| 1 | Prebuilt: install the script, `initChatWidget` config (widget token, user identity, title, icon, height, type) | `public/chat-widget.js` |
| 2 | Prebuilt: control it from the page (`open`, `close`, `sendMessage`, `hideChatbotWithIcon`, `showChatbotIcon`, starter questions, launcher preview, `reload`) | `public/chat-widget.js` |
| 3 | Prebuilt: events the widget sends to the page (`OPEN_CHATBOT`, `CLOSE_CHATBOT`, `TICKET_UNREAD_COUNT`, `SET_BADGE_COUNT`, `uuid`, `PUSH_NOTIFICATION`, …) | `utils/emitEventsToParent` |
| 4 | Custom UI: core concepts (widget token, anonymous vs identified client, region, JWT, channel = ticket, message, bot/agent/team) | `docs/ARCHITECTURE.md`, `types/hello` |
| 5 | Session & identity: routing-region → widget-info → anonymous client → JWT → save client details | `helloApi.ts` lines 48–110, 264, 343, 377 |
| 6 | Conversations list: channels, unread counts, new-channel | `getAllChannels`, socket `new-channel` |
| 7 | Messages: send, history paging, full-message, reply-to | `sendMessageToHelloApi`, `getHelloChatHistoryApi`, `getFullMessageApi`, `MODULE_CHAT_WIDGET_REPLY.md` |
| 8 | Message types & how to render them: text, attachment, text-attachment, interactive, feedback, video_call | `MessageType.ts`, `components/Hello/*` |
| 9 | Realtime: socket connect, every event (`chat`, `assign`, `feedback`, `block`, `new-channel`, `update`, `typing`, `not-typing`), reconnect | `socketManager.js`, `socketEventHandler.ts` |
| 10 | Attachments: upload, limits, render | `uploadAttachmentToHello` |
| 11 | Typing indicators & read receipts | socket emit, `deleteReadReceipt` |
| 12 | Bot greetings & starter questions | `getGreetingQuestions` |
| 13 | Feedback / CSAT | `submitFeedback`, `RenderHelloFeedbackMessage` |
| 14 | Voice & video calls (WebRTC tokens) | `getClientToken`, `getCallToken`, `MODULE_CHAT_WIDGET_CALLING.md` |
| 15 | Push notifications (FCM) | `subscribeForFCMPushNotification`, `hooks/notifications` |
| 16 | Agents & teams, assignment state | `getAgentTeamApi`, socket `assign` |
| 17 | Errors & troubleshooting (every error code, "it doesn't connect") | `helloInterceptor.ts` |
| 18 | Reference: full TypeScript types | `types/hello/HelloReduxType.ts` |
| R1 | Recipe: custom UI in React (hooks) | — |
| R2 | Recipe: custom UI in plain JS | — |
| R3 | Recipe: mobile / React Native | — |

Chapters 5, 7, 9 are the spine of Route B. Everything else is optional and says so at the top.

## Chapter template (what makes it agent-friendly)

Every chapter starts with the same five lines so an agent can decide in two seconds whether to
keep reading:

```
# <Feature>
Read this when: <one sentence>
Needs first: <links to prerequisite chapters>
Package call: <function name>  ·  Raw: <METHOD /path>
Finished when: <checklist>
```

Then: one working snippet (package), one raw request/response JSON, edge cases, errors. No prose
history, no "why we built it". Links are absolute URLs so the chapter works when pasted alone.

## Where it lives

- **Skill folder:** new repo or `skill/` in this repo, published to the skills registry
  (`npx skills add msg91/hello-chat-skill`). Mirrors `Embarko/skill/`.
- **Chapters:** `docs/hello-chat-skill/*.md` in this repo (folder already exists, empty). Served
  raw at a stable URL (GitHub raw to start; a `/docs/<slug>.md` route on the widget host later,
  like `hostnsoft/app/llms.txt`). Skill links point there.
- **Package:** extracted from `config/` + `hooks/` into a small headless package. Phase 2.

## Phasing

1. **Phase 1 (docs only):** `SKILL.md` + chapters 0–9, 17, 18 written against the raw HTTP/socket
   contract. Route A fully works. Route B works for agents willing to call HTTP directly.
2. **Phase 2 (package):** extract headless core, add "Package call" lines and recipes R1–R3.
3. **Phase 3:** our own widget consumes the same package (dogfood), MCP/connector variant.

## Non-goals

- No new backend endpoints. The book documents what exists.
- Not a UI kit. Route B gives data + events, zero components.
- Not replacing `docs/MODULE_*.md`. Those are for contributors; the book is for customers' agents.

## Decisions (owner, 2026-11-20)

1. **Headless package: yes**, as Phase 2. Reason it beats raw APIs: the session is a 7-step ordered chain, socket.io is hard to spec in prose, and when a key changes one package release plus an adapter fixes every customer instead of every customer's hand-written code. Intercom, Sendbird, Stream, Twilio and Chatwoot all ship SDK-first, REST as fallback. Raw contract is still documented for native mobile and no-npm agents.
2. **Chapters live in `public/skill/`** so every environment (local, test, prod) serves its own version at `<widget-host>/skill/<chapter>.md`. `public/llms.txt` mirrors the index for agents that don't have the skill installed. One copy: the installable `SKILL.md` is the same file, downloaded from the host.
3. **All `helloApi.ts` endpoints approved as public contract.**
4. **Auth for custom UI:** same as the widget (widget token + client uuid). With identity verification on, the customer's server signs `user_jwt_token`; the UI only forwards it.

## Open questions (resolved above, kept for history)

1. **Headless package: yes or docs-only first?** Changes Phase 1 scope.
2. **Hosting URL for chapters** (GitHub raw vs a Hello/MSG91 docs domain). Changes every link.
3. **Are the Hello endpoints in `helloApi.ts` approved as a public contract?** If not, which ones
   are off-limits for customers (e.g. `add-domain`, `receive-feedback`)?
4. **Auth for custom UI:** is widget token + anonymous client enough for a customer's server-side
   use, or do they need a server-side key for identified users?

## Decisions I made on my own (say if wrong)

- Book shape and chapter template copied from the Embarko skill.
- Chapters live in this repo under `docs/hello-chat-skill/`.
- Route A is the default; Route B only when the customer asks for custom UI.
- Recommend headless package, but Phase 1 can ship without it.
