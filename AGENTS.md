# chat-widget (MSG91 Hello web widget, `test` line)

A plain-JS embed script (`public/chat-widget.js`) that customers put on their sites, plus the Next.js 15 / React 19 / Redux app it loads in an iframe (`/chatbot`). The iframe talks to the MSG91 Hello backend over HTTP (`config/helloApi.ts`) and two socket.io connections. It is frontend only: never implement backend logic (assignment, ticketing, routing, AI) here, and treat Hello's responses as the source of truth.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` (no lockfile is committed) |
| Run locally | `npm run dev` (port 3000), then a host page on another port loading `http://localhost:3000/chat-widget-local.js` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build`; Cloudflare Pages: `npm run build:pages` |
| Test | none; there are no tests. Check by hand (see [environment](docs/environment.md)) |

`npm run preview` and `npm run deploy` are broken (they call `pages:build`, which does not exist).

## Read before you change

- Anything → [docs/architecture.md](docs/architecture.md), then [docs/conventions.md](docs/conventions.md)
- Shipping any change, or a common kind of change → [docs/recipes.md](docs/recipes.md)
- Embed script, window API, `initChatWidget` keys, postMessage events → [docs/modules/embed-script.md](docs/modules/embed-script.md), [docs/api.md](docs/api.md)
- Iframe routes, providers, host-event handlers → [docs/modules/app-shell.md](docs/modules/app-shell.md)
- Hello REST calls, region routing, identity, init sequence → [docs/integrations/hello-api.md](docs/integrations/hello-api.md)
- Sockets, reconnects, co-browse → [docs/modules/realtime.md](docs/modules/realtime.md)
- Redux, persistence, cross-tab sync, storage keys → [docs/ui/state.md](docs/ui/state.md)
- Chat UI and theming → [docs/ui/components.md](docs/ui/components.md), [docs/ui/design-system.md](docs/ui/design-system.md)
- Message types and the generic message shape → [docs/modules/message-rendering.md](docs/modules/message-rendering.md)
- Voice calls → [docs/modules/voice-calling.md](docs/modules/voice-calling.md)
- End-to-end paths → [boot](docs/flows/widget-boot.md), [send](docs/flows/send-message.md), [receive](docs/flows/receive-message.md)
- Env vars and `?env=stage` → [docs/environment.md](docs/environment.md); unclear names → [docs/glossary.md](docs/glossary.md)

## Rules

1. Make every change on both release lines: a PR into `test` and a separate branch and PR into `react-main` (production). Never merge a `test`-based branch into `react-main`; PR #478 did and was reverted. `main` is the old Angular app. See [recipes](docs/recipes.md).
2. Change all three embed scripts (`public/chat-widget.js`, `public/chat-widget-dev.js`, `public/chat-widget-local.js`) together, keeping only their intended differences. They are hand-maintained copies; production once missed a feature for five months.
3. The host-page API is public. Never rename or remove a `window.chatWidget` method, an `initChatWidget` key or a postMessage type; customers call them from their own sites.
4. A new `initChatWidget` key must be added to `keysToRemove` in `components/Chatbot/hooks/useHelloEffects.ts`, or it is saved onto the customer's contact via `saveClientDetails`.
5. A new host → iframe event needs `addEventHandler` in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`; a new iframe → host event needs a `ParentEventType` member and a `case` in `handleIncomingMessages`. Unregistered types are dropped silently.
6. Never use `window.localStorage` / `sessionStorage` directly. Use `setLocalStorage` / `getLocalStorage` in `utils/utilities.js` or `utils/safeStorage.ts`, because iOS in-app webviews block iframe storage (401s with `Authorization: null:null`).
7. Every `config/helloApi.ts` function swallows errors and returns `null` or `[]`. Check the return value; `.catch` never fires.
8. Call `getRoutingRegion` before any other Hello call, and never cache the Hello host at module load; every other endpoint is region-locked. On a region change call `socketManager.reconnect()`, not `disconnect()`.
9. Sending is HTTP (`POST /v2/send/` via `useOnSendHello`); the socket only receives, plus subscribe and typing emits. Subscribe channels only through `socketManager.subscribe` so they are re-subscribed on reconnect. Open no socket connections besides the chat and notification managers.
10. Hello and appInfo reducers read their key from `action.urlData`, never the payload. Export new Hello reducers from `store/hello/helloSlice.ts`, and exclude per-tab or socket-driven actions from `crossTabSyncConfig` in `store/index.js`, or they apply twice across tabs.
11. Always enter the iframe through `/chatbot`, never `/chatbot/hello` directly; `/chatbot` creates the per-tab session id.
12. The embed script's postMessage handlers and the iframe's handlers close over first-render values. Read changing values through refs. ESLint's hooks rules are switched off, so nothing will warn you.
13. `next build` ignores type and lint errors. Run `npx tsc --noEmit` and `npm run lint` yourself before finishing.
14. Keep the misspelled names that are load-bearing: `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL`, `assests/`, `CBManger.ts`, `RenderHelloVedioCallMessage.tsx`. Do not "fix" them in one place.
15. Do not add hard-coded URLs, tokens or new environment heuristics. The existing exceptions (stage hosts, Cobrowse license) are listed in [environment](docs/environment.md).

## Where things are

- `public/` — embed scripts, their stylesheet, `urlMonitor.js`
- `app/chatbot/` — the two iframe pages; `app/page.tsx` is unused boilerplate
- `components/Chatbot/` — container and the hooks that run init, sending, sockets and voice
- `components/Interface-Chatbot/` — chat UI; `components/Hello/` — Hello message renderers
- `config/` — Hello REST client and region routing
- `hooks/` — postMessage bridge (`hooks/CORE/`, `hooks/HELLO/`), sockets, notifications, co-browse
- `store/`, `types/` — Redux slices and their types
- `utils/` — storage wrappers, message converters, toasts, parent events

## Working style

Keep changes small and scoped. Reuse existing helpers and dependencies instead of adding libraries, and do not replace Redux, socket.io or axios. Use React context only for local UI state.

## Docs map

See [docs/README.md](docs/README.md) for every doc, when to read it, and the open questions that need a human.
When you change behaviour that a doc describes, update that doc in the same change and run `/ai-docs update`.
