# chat-widget

The frontend of an embeddable chat widget. Customer sites load a plain-JS loader script from `public/`, and that script opens an iframe onto this Next.js 15 app (React 19, Redux Toolkit + saga, MUI + Tailwind), which is deployed on Cloudflare Pages.

One UI serves two backends, both in other repos:
- **GTWY**: an AI bot. Messages go over HTTP; replies come back over rtlayer.
- **MSG91 Hello**: human agents, tickets and calls, over the Hello REST API and socket.io.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` (there is no lockfile) |
| Run locally | `npm run dev` (port 3000), then open a host page that loads `public/chat-widget-local.js` or `public/chatbot-local.js` ([docs/environment.md](docs/environment.md)) |
| Type-check | `npx tsc --noEmit`. `next build` skips type errors |
| Lint | `npm run lint`. `next build` skips lint |
| Build for Cloudflare | `npm run build:pages`. The `preview` and `deploy` scripts are broken: they call a non-existent `pages:build` |

There are no tests and no CI. Check changes by hand through a local loader script.

## Read before you change

- Anything → [docs/architecture.md](docs/architecture.md), then [docs/conventions.md](docs/conventions.md)
- Loader scripts, `window.*` API, postMessage → [docs/modules/embed-scripts.md](docs/modules/embed-scripts.md) and [docs/api.md](docs/api.md)
- Boot, URL params, store setup → [docs/modules/app-shell.md](docs/modules/app-shell.md), [docs/flows/widget-boot.md](docs/flows/widget-boot.md)
- AI bot messages → [docs/flows/ai-message.md](docs/flows/ai-message.md)
- Hello (human chat, channels, calls) → [docs/integrations/hello.md](docs/integrations/hello.md), [docs/flows/hello-human-chat.md](docs/flows/hello-human-chat.md)
- Chat UI components → [docs/modules/chat-ui.md](docs/modules/chat-ui.md)
- JSON UI in AI replies → [docs/modules/interface-renderer.md](docs/modules/interface-renderer.md)
- State, routes, components, styling → [docs/ui/](docs/README.md#ui)
- A common change → [docs/recipes.md](docs/recipes.md)

## Rules

1. Edit all three copies of a loader script together (`public/chat-widget.js` / `-dev` / `-local`, and the same for `public/chatbot*.js` and `public/rag-*.js`). Nothing generates them, and they have already drifted apart.
2. Never rename or remove these, because customer sites call them: `window.*` globals in the loader scripts, `ParentEventType` values in `utils/emitEventsToParent/emitEventsToParent.tsx`, host→iframe message types, and script file names. Add new ones instead ([docs/api.md](docs/api.md)).
3. A new iframe→host event needs a `ParentEventType` value. If the loader script itself must react to it, it also needs a `case` in every Hello script's `handleIncomingMessages`; the script ignores types it doesn't know ([recipe](docs/recipes.md)).
4. A new `initChatWidget` option that isn't a client field must go into `keysToRemove` in `components/Chatbot/hooks/useHelloEffects.ts`. Otherwise it is saved on the customer's Hello contact record.
5. `getRoutingRegion()` must run before any other Hello call. Get hosts per call from `config/regionConfig.ts` (`HELLO_HOST_URL()`, `getSocketUrl()`); never cache them, and never persist the region.
6. Every `config/helloApi.ts` function swallows its error and returns `null` or `[]`. Check the return value; a try/catch never fires.
7. Don't open new socket or realtime connections; use the existing one for each backend ([docs/conventions.md](docs/conventions.md#realtime-and-http)). GTWY replies come over rtlayer, never `socketManager`.
8. A new Hello chat must subscribe to its proposed channel *before* `POST /v2/send/` (`useOnSendHello`). Otherwise the first bot reply is lost.
9. Write the current thread or channel to `appInfo[tabSessionId]` with `setDataInAppInfoReducer`. Never set `Chat.subThreadId` directly; `useReduxEffects` copies it over.
10. Edit `store/chat/chatReducerV2.ts` for chat state. `components/Chatbot/hooks/chatReducer.ts` is dead code.
11. A new Redux slice is persisted to localStorage and synced across tabs by default. Opt it out in both the root `blacklist` and `crossTabSyncConfig.predicate` if it is per-tab ([docs/ui/state.md](docs/ui/state.md)).
12. Read and write client ids through `getLocalStorage` / `setLocalStorage` in `utils/utilities.js`, which add the widget-token prefix. Don't use raw keys.
13. Hosts come from env vars or `config/regionConfig.ts` getters, never literals. `?env=stage` is the only environment switch; don't add others or infer the environment from the hostname.
14. Don't send untrusted content into the `dangerouslySetInnerHTML` or shadow DOM message paths ([docs/modules/chat-ui.md](docs/modules/chat-ui.md)). Never copy the hard-coded rtlayer or cobrowse keys into docs or logs.
15. Ship each change as two PRs: one into `test` (title `TEST = …`) and one into `react-main`, which is production (title `MAIN = …`). Always pass `--base`: the GitHub default branch `main` is stale and never deploys ([docs/conventions.md](docs/conventions.md#branching-and-release)).

## Where things are

- `public/`: loader scripts (`chat-widget*` = Hello, `chatbot*` = GTWY, `rag-*`, `urlMonitor.js`)
- `app/chatbot/`: the iframe entry and the widget page
- `hooks/CORE|HELLO|GTWY/eventHandlers/embeddingScript/`: host postMessage handlers
- `components/Chatbot/hooks/`: send, receive and boot logic for both products
- `components/Interface-Chatbot/`: chat UI; `components/Hello/`: Hello message renderers
- `config/`: API clients (`api.ts`, `helloApi.ts`, `ragApi.ts`) and `regionConfig.ts`
- `store/`: slices, persistence, cross-tab sync, saga
- `hooks/socketManager.js`, `hooks/notifications/`: socket.io connections
- `docs/brainstorms/`: design notes (region routing)

## Docs map

See [docs/README.md](docs/README.md) for every doc, when to read it, and the open questions for humans.
When you change behaviour a doc describes, update that doc in the same PR (`/ai-docs update`).
