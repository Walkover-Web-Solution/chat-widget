---
covers: ["*"]
verified_at: 5a4b60e
verified_on: 2026-11-03
---

# Product Vision & Strategic Direction

> **Status: draft, pending owner review.** This file decides which requests are worked. It was recovered from the repository's own docs and code; nothing here is approved until an owner signs off.

The chat widget is an embeddable, frontend-only chat module that lets companies place a chat window on their websites with a script tag (`docs/ARCHITECTURE.md`). Through it, website end-users talk in real time with an AI bot, an individual human agent or a team of agents, as decided by a separate backend. This repository owns only the client: rendering, UI state and real-time transport. Ticketing, assignment, AI behavior and persistence belong to the backend (`docs/AI_INSTRUCTIONS.md`, "Scope of This Codebase").

## Authoritative Sources & Status

Sources used, in order of authority:

1. `docs/AI_INSTRUCTIONS.md`: declares itself "authoritative" for scope, stack and prohibited changes.
2. `docs/ARCHITECTURE.md`: system boundaries, data flow, non-goals.
3. `docs/MODULE_CHAT_WIDGET.md` and the feature docs `docs/MODULE_CHAT_WIDGET_REPLY.md`, `docs/MODULE_CHAT_WIDGET_CALLING.md`, `docs/MODULE_CHAT_WIDGET_DEMO_CHATBOT.md`.
4. `docs/brainstorms/region-wise-routing-requirements.md` (status: "Decided, implemented").
5. `README.md` (documentation reading order), `package.json` (name `chatbot-nextjs`, no description).
6. The code at the commit above, and the git history (commit subjects only).

`REPLY_FEATURE.md` at the root is identical to `docs/MODULE_CHAT_WIDGET_REPLY.md`.

### Approved Direction

What the docs state as the product's purpose and boundaries:

- A **frontend-only** chat widget, embedded on client websites by a script tag and deployed to Cloudflare Pages through `@cloudflare/next-on-pages`.
- Each company is identified by a **widget token**, which is sent with every request and scopes the conversation to that company's backend workspace.
- The backend routes conversations to an **AI bot, a human agent or a team**. The frontend renders the result and never decides routing.
- **Communication model**: the first message goes over HTTP to establish the conversation, and everything after that goes over WebSockets through one centralized socket manager.
- **The backend is the source of truth.** Redux holds temporary UI and session state only.
- **Stack** (intentional and stable): Next.js App Router, TypeScript, React, MUI with Emotion, Tailwind, Redux Toolkit with Saga and Persist, `socket.io-client`, Axios.
- **Environments**: test and production, configured through environment variables, never hardcoded or inferred from the hostname.
- **Documented features**: reply to message, voice calling (WebRTC; shown only when widget data enables it) and demo chatbot mode (`demo_widget`; no persistence at all).
- **Region routing**: the company's region comes from `POST /routing-region` on every load and is held in memory, never persisted.

### Current Implementation

What the code does today. Where a feature has no doc of its own, it is listed here as implemented and its status is an open question.

- **Two embed scripts.** `public/chat-widget.js` is the "Hello Widget" (phone91 / MSG91 backend, `config/helloApi.ts`, `hooks/HELLO`). `public/chatbot.js` is an AI chatbot embed pointing at `chatbot.gtwy.ai` (`config/api.ts`, `hooks/GTWY`, routes under `app/chatbot`). The docs describe only the widget-token flow.
- **A knowledge-base page** at `app/rag` (`config/ragApi.ts`) uploads files and URLs and configures chunking. The docs don't mention it.
- **Generic interface renderers** (`components/Interface-*`, `Grid`, `ComponentRenderer`) render backend-described UI such as forms, tables, cards and buttons inside chat.
- **Features without a feature doc**: co-browsing and screen sharing (`hooks/coBrowser`, `CobrowseManager` in `chat-widget.js`), video-call messages, incoming web calls, interactive, carousel and Apple interactive messages, feedback messages, push-notification previews (`hooks/notifications`), thread history (`ThreadSidebar`), multiple widgets on one page, anonymous-to-known chat merging, prefilled messages and storage fallbacks for in-app WebViews. Evidence for these comes from the code and the git history.
- **Hardcoded hosts** in `config/api.ts` (for example `api.phone91.com` and `flow-api.viasocket.com`) and `public/chatbot.js` sit alongside the rule against hardcoding URLs.
- `app/page.tsx` and the root metadata are still the `create-next-app` defaults.

### Proposals & Roadmaps

- `docs/MODULE_CHAT_WIDGET_REPLY.md`, under "Future Enhancements", lists reply threads, replying to replies, reply notifications, reply context, keyboard shortcuts, analytics, agent tools, bot replies and mobile apps. These are labelled "Potential Improvements" and have not been approved.
- No other roadmap, PRD or planning doc exists in the repository.

### Unknowns & Ambiguities

Every point marked "Not stated: an owner decides" below is tracked as a question in [`docs/OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md). The largest one is whether the GTWY AI chatbot embed and the knowledge-base page fall under this vision or belong to a separate product that shares the repository.

## Target Audience & Ideal Customer Profile (ICP)

- **Primary customer: a company that embeds the widget on its website.** It is identified by a widget token, and its developer or site owner adds the script tag. Role, workflow and technical level beyond "can add a script tag": Not stated: an owner decides.
- **Primary user: the website end-user (visitor or customer).** They open the widget, send messages, reply, call and get answers from a bot, agent or team. They need no technical knowledge, and demo-mode behavior "requires no additional actions" from them.
- **Secondary: human agents and teams** who answer conversations. They work in the backend system, not in this repository.
- **Secondary: whoever configures the widget.** Calling, demo mode, theme and similar widget data come from the backend, and the admin persona and its tool are outside this repository. Not stated: an owner decides.
- **Auditors and compliance reviewers**: Not stated: an owner decides.
- **Testers and demonstrators** use demo chatbot mode for "testing and demonstration purposes" (`docs/MODULE_CHAT_WIDGET_DEMO_CHATBOT.md`).

## Problems Solved & Value Proposition

| Customer problem | How the product solves it | What sets it apart |
| --- | --- | --- |
| A company wants chat on its website without building it | One script tag and a widget token embed a ready-made widget | Not stated: an owner decides |
| Visitors need answers from the right responder | The backend routes each conversation to an AI bot, an agent or a team; the widget renders any of them in one UI | Not stated: an owner decides |
| Conversations need to be live | The first message goes over HTTP, then real-time WebSocket delivery through one socket manager | Not stated: an owner decides |
| Some questions need voice | WebRTC voice calls from the widget when calling is enabled, with rejoin after a reload | Not stated: an owner decides |
| Replies lose context in long chats | Reply to a specific message (`replied_on`) | Not stated: an owner decides |
| Teams need to test or demo a bot without polluting data | Demo mode (`demo_widget`) keeps everything in memory and resets on reload | Not stated: an owner decides |
| Companies live on different regional backends | The region is resolved per load from `/routing-region`; API and socket calls follow it | Not stated: an owner decides |

## Core Principles & Design Philosophy

1. **The backend is the source of truth.** The frontend renders and transports, and never owns conversation state, routing or business rules. *Trade-off:* a feature that needs a new decision waits for a backend capability instead of being simulated in the client.
2. **Frontend-only, tenant-scoped by widget token.** Every request carries the widget token, and the widget never reaches across companies. *Trade-off:* a convenience that would need shared or cross-tenant client state is rejected.
3. **Reuse the established stack and one path per concern.** Redux Toolkit with Saga, a single socket manager and Axios. *Trade-off:* consistency and maintainability win over adopting a newer or more convenient library.
4. **Configuration-driven behavior.** Features appear only when widget data enables them (calling, `demo_widget`), and environments come from environment variables. *Trade-off:* the client never infers flags, environments or regions from heuristics, even where a guess would work.
5. **Freshness over caching for routing.** The region is re-fetched on every load and never persisted. *Trade-off:* one extra call per load is accepted rather than risk a stale region.
6. **Incremental change, with docs as part of the code.** Minimal, localized edits, and every major feature gets its own `MODULE_CHAT_WIDGET_*.md`. *Trade-off:* large refactors and undocumented features are not accepted, even when faster.

## Strategic Priorities & Success Measures

- **Top priorities:** Not stated: an owner decides. Recent git history shows active work on region routing, calling and co-browsing, widget merging and WebView storage, but that describes activity, not stated priorities.
- **Success metrics:** Not stated: an owner decides. The repository defines no metric. The feature docs' testing checklists define correctness, not success.

## Boundaries & Non-Goals

What the product deliberately does not do, as stated in `docs/ARCHITECTURE.md` and `docs/AI_INSTRUCTIONS.md`:

- Implement backend APIs, ticket creation or ticket logic.
- Manage agent assignment or routing rules, or decide AI behavior.
- Act as an authoritative data store. Redux is temporary UI state only.
- In calling: route calls, infer call ownership or manage call authorization.
- In demo mode: persist conversations, create or reuse channels, or store session identifiers.

Anti-patterns that break the vision:

- Simulating backend logic, or mocking endpoints, in the frontend.
- Opening WebSocket connections outside the socket manager, or putting business logic in socket handlers.
- Introducing a second state store, or bypassing Redux.
- Hardcoding URLs, tokens or environment values, or inferring the environment from the hostname.
- Adding a library when an existing dependency already covers the need.
- Persisting the routing region.
- Shipping a major feature without its module doc.

## How Future Agents Must Evaluate Requests

1. **Compare** the request with the Approved Direction, the ICP, the Core Principles and the Non-Goals above, not with the request's own wording.
2. **Improve an unclear request before writing code.** Restate the outcome and acceptance criteria. If this file is silent or ambiguous on the point, ask, and add the question to `docs/OPEN_QUESTIONS.md`.
3. **Explain conflicts.** When a request conflicts with this file, name the section it breaks, recommend declining it or changing it, and propose a version that fits.
4. **Make direction changes explicit.** A deliberate change of direction must be approved by an owner and recorded in this file in the same change as the code. Never loosen this file just to let a request through.
5. **Never fabricate backend capabilities.** When a feature needs an endpoint, socket event or field the backend does not provide, describe the needed contract in `docs/CONTRACTS.md` (request, response, events, owner) and treat the feature as blocked on it. Do not build mock endpoints or fake integrations in the frontend.
6. **Keep the docs in step.** Follow `docs/AI_INSTRUCTIONS.md`, and add or update the feature's `MODULE_CHAT_WIDGET_*.md`.
