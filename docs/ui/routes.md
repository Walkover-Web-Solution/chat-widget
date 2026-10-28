---
covers: ["app/**/page.tsx", "app/**/layout.tsx", "app/error.tsx"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Routes and pages

Next.js 15 App Router, everything under `app/`. Every page is a client component (`'use client'`) rendered inside an iframe on a customer's site; there is no login and no server data fetching. The redirect logic on `/chatbot` is described in [app-shell](../modules/app-shell.md#boot-inside-the-shell); this page is the lookup table.

| Route | File | Runtime | Loaded by | Query params read | What it is |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | default | nobody on purpose | none | Unmodified create-next-app page. The 401 handler in `utils/interceptor.ts` sends the iframe here (`/?error=session expired`). |
| `/chatbot` | `app/chatbot/page.tsx` + `app/chatbot/layout.tsx` | edge | iframe created by `public/chat-widget*.js` (Hello) and `public/chatbot*.js` (GTWY) | `interfaceDetails` (URL-encoded JSON), `env` (kept only if `stage`) | Entry point. Creates `tab_session_id`, stores the GTWY token, then `router.replace` to `/chatbot/<chatbot_id>` or `/chatbot/hello`. Shows a daisyUI spinner meanwhile. |
| `/chatbot/[chatbotId]` | `app/chatbot/[chatbotId]/page.tsx` (same layout) | edge | `router.replace` from `/chatbot` | `env` (read at module load by `config/regionConfig.ts`, `components/Chatbot/hooks/HelloVoiceService.ts`, `hooks/notifications/notificationSocketManager.ts`) | The widget. Renders `components/Chatbot-Wrapper/ChatbotWrapper.tsx`. GTWY uses `/chatbot/<chatbot_id>`; Hello uses the literal `/chatbot/hello`. The `chatbotId` param is never read. |
| `/chatbotpreview` | `app/chatbotpreview/page.tsx` | edge | not referenced by any script in this repo | none | Static, self-contained mock chat used to preview a theme color. Listens for `{ type: "themeChange", themeColor }` by postMessage. See [interface-renderer](../modules/interface-renderer.md#chatbotpreview). |
| `/rag` | `app/rag/page.tsx` | default (no `runtime` export) | iframe created by `public/rag-prod.js`, `public/rag-dev.js`, `public/rag-local.js` (`ragUrl`) | none (config arrives by postMessage `INITIAL_CONFIG`) | GTWY knowledge-base add/edit/delete form. Stores `ragToken` in sessionStorage. |
| error boundary | `app/error.tsx` | n/a | any route segment that throws | none | "Something went wrong" card. "Try again" calls `reset()`; "Close" posts `{ type: "CLOSE_CHATBOT" }` to `window.parent` (falls back to `/` when not framed). |

> [!TODO] Needs a human: who iframes `/chatbotpreview` (the GTWY dashboard?) and is it still used?

## Navigation and layout

- **Root layout** `app/layout.tsx` (server component): `<html data-theme="light">`, Geist font variables, `app/globals.css`, and `components/AppWrapper.tsx` (Redux `Provider` → `PersistGate` → MUI `ThemeProvider` → `ThemeContext`). Every route, including `/rag` and `/chatbotpreview`, gets the store and theme. Metadata is still the create-next-app default.
- **`app/chatbot/layout.tsx`** wraps both `/chatbot` and `/chatbot/[chatbotId]`. It parses `interfaceDetails` and `env` once (`useMemo` with `[]`), provides `ChatbotContext` (`components/context.tsx`), applies `config.themeColor`, and writes `chatBotId`/`userId`/`config` into `appInfo`. Because the layout is shared, it is **not** remounted by the `router.replace` from `/chatbot` to `/chatbot/<id>`, so the values parsed from the first URL survive the redirect.
- **No middleware, no auth guard.** Authentication is per request: `interfaceToken` (GTWY) or the Hello widget token in the axios clients. See [app-shell](../modules/app-shell.md#contracts).
- **Deep links:** the only supported entry is `/chatbot?interfaceDetails=…[&env=stage]`. The host scripts build it; see [embed-scripts](../modules/embed-scripts.md). Opening a ticket directly is done by postMessage (`CHATBOT_OPEN {id}`), not by URL.
- **`env` forwarding:** `/chatbot` appends `?env=stage` only on the Hello redirect (`/chatbot/hello?env=stage`). The GTWY redirect drops it.

> [!WARNING]
> A hard reload of `/chatbot/hello` or `/chatbot/<id>` (for example an iOS in-app browser reloading the iframe) has no `interfaceDetails`, so `ChatbotContext` falls back to its defaults (`isHelloUser: false`, `token: null`). Code that needs the mode should read `state.draftData.isHelloUser` rather than `ChatbotContext`: `draftData` is not persisted either, but the Hello embedding-script handler sets `isHelloUser: true` again when the host re-sends `helloData` after the iframe loads. `components/Chatbot/hooks/useRtlayerEventManager.tsx` is the one place that reads `isHelloUser` from the context.

> [!WARNING]
> Any new dynamic route must `export const runtime = "edge"`, or `npm run build:pages` (`@cloudflare/next-on-pages`) fails. `/rag` gets away without it because it is static. Keep page code edge-safe (no Node APIs).

> [!WARNING]
> Modules that read `window.location.search` at import time (`config/regionConfig.ts`, `HelloVoiceService.ts`, `notificationSocketManager.ts`) see whichever URL is current when their chunk first loads. A new query param that such a module needs must be forwarded on the redirect in `app/chatbot/page.tsx`, like `env`.

## Adding a page

1. Create `app/<name>/page.tsx` with `'use client'` and, if the segment is dynamic, `export const runtime = "edge"`.
2. If the host must load it, add the URL to the matching `public/*.js` loader in all env variants ([embed-scripts](../modules/embed-scripts.md)).
3. If it needs Redux, it already has the store from the root layout; per-tab state needs `draftData.chatSessionId` and `draftData.tabSessionId` set first ([state](state.md)).
4. Talk to the host with `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent` and add the type to `ParentEventType`.
