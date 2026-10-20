---
covers: ["package.json", "next.config.ts", "tsconfig.json", ".eslintrc.json", "eslint.config.mjs", "config/regionConfig.ts", "config/api.ts", "config/helloApi.ts", "config/ragApi.ts", "hooks/notifications/notificationSocketManager.ts", "utils/utilities.js", "public/chat-widget*.js", "public/chatbot*.js", "public/rag-*.js"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Environment

A Next.js 15 (App Router) frontend, deployed to Cloudflare Pages with `@cloudflare/next-on-pages`. It has no server code, no database and no .env.example. All configuration is a handful of NEXT_PUBLIC_* base URLs, a `?env=stage` URL switch, and URLs hard-coded in the embed scripts in `public/`.

## Run it locally

1. Node: no version is pinned (no .nvmrc, no `engines`). Next 15.1.6 needs Node 18.18+.
2. `npm install`. There is **no lockfile** in the repo (`.gitignore` does not list one either), so installs are not reproducible; `wrangler` is pinned `~4.107.1`, everything else uses `^` ranges.
3. Create .env.local with the variables in the table below. `.gitignore` ignores .env*.
   > [!TODO] Needs a human: where do developers get the values for the NEXT_PUBLIC_* URLs (dev/stage/prod GTWY and MSG91 hosts)? There is no .env.example and no doc in the repo.
4. `npm run dev` → `next dev --turbopack` on **http://localhost:3000**.
5. The pages are not useful on their own; the widget runs inside an iframe that a host page creates. To test it, make a static HTML page (any other origin, e.g. `npx serve` on another port) that loads a `-local` script from the dev server:
   - Hello: `<script src="http://localhost:3000/chat-widget-local.js"></script>` then `window.initChatWidget({ widgetToken: '<token>' })`. The script uses the port (`3000`) as its subdomain and points the iframe, CSS and `urlMonitor.js` at `http://localhost:3000`. Add `?env=stage` to the host page URL to hit MSG91 stage servers.
   - GTWY: `<script id="chatbot-main-script" src="http://localhost:3000/chatbot-local.js" embedToken="…"></script>`. `public/chatbot-local.js` has its login URL commented out, so `fetchChatbotDetails` has no URL to call; you may need to point it at a GTWY backend temporarily (do not commit that).
   - RAG: `public/rag-local.js` hard-codes `http://localhost:3001` for the `/rag` iframe and `http://localhost:7072` for the GTWY backend. Run `npm run dev -- -p 3001` to use it unchanged.
   - Opening `http://localhost:3000/chatbot` directly renders with no token, so nothing loads.
6. `npm run lint` → `next lint`. There is no test runner, no test files and no CI (no .github folder). Type-check by hand with `npx tsc --noEmit` (it reports existing errors; see below).

## Variables

Every variable here is NEXT_PUBLIC_* (except the last two) and is **inlined into the browser bundle at build time**. None is secret; never put a secret in one. Changing a value needs a rebuild, not a restart.

| Var | Required | Default | Read in | Purpose / effect if missing |
|---|---|---|---|---|
| `NEXT_PUBLIC_PYTHON_API_BASE_URL` | yes (GTWY) | none | `config/api.ts` (`PYTHON_URL`) | GTWY Python API: send message, image upload. Missing → requests go to `undefined/chatbot/...`; GTWY bot cannot answer. |
| `NEXT_PUBLIC_API_BASE_URL` | yes (GTWY, RAG) | none | `config/api.ts` (`URL`), `config/ragApi.ts` | GTWY Node API: history, threads, feedback, `/hello/subscribe`, RAG docs and embed token. Missing → history/threads/RAG fail. |
| `NEXT_PUBLIC_MSG91_HOST_URL` | yes (Hello) | `https://stageapi.phone91.com` when `?env=stage` | `config/regionConfig.ts` | Default MSG91 Hello REST host until `POST /routing-region/` returns a region URL. Missing → `getHelloHostUrl()` returns `''` and the first Hello calls go to relative paths on the widget's own origin; Hello never boots. |
| `NEXT_PUBLIC_SOCKET_URL` | yes (Hello) | `https://stagechat.phone91.com` when `?env=stage` | `config/regionConfig.ts` | Default Hello chat socket.io host until routing-region sets one. Missing (and no region) → no live agent messages or typing. |
| `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` (typo is the real name) | optional | `https://notifications.phone91.com` when `?env=stage` | `hooks/notifications/notificationSocketManager.ts` | Notification socket (push popups, launcher previews). Missing → `io(undefined)` connects to the iframe's own origin and fails; notifications silently off. |
| `NEXT_PUBLIC_PUSH_NOTIFICATION_URL` | optional | none | `config/helloApi.ts` | Base for `POST /add-user-fcm-token/`, used only in mobile-SDK mode with `pushConfig`. Missing → that call fails (logged). |
| `REACT_APP_API_ENVIRONMENT` | no | none | `utils/utilities.js:getCurrentEnvironment` | Name of the cookie removed on a 401 in `utils/interceptor.ts`. Not NEXT_PUBLIC_, so it is `undefined` in the browser bundle: the cleanup removes a cookie named `undefined`. Leftover from a CRA template. |
| `NODE_ENV` | no | set by Next | `next.config.ts` (commented-out code only) | Not read by live code. |

> [!WARNING]
> Do not rename `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` to fix the spelling without renaming it in every deployment's environment at the same time; the code would read `undefined` and notifications would stop silently.

## The `?env=stage` switch

Environment is not chosen only by env vars. The **iframe URL** query `env=stage` overrides several hosts at module load:

| Where | `env=stage` effect |
|---|---|
| `config/regionConfig.ts` | Hello REST default → `https://stageapi.phone91.com`, socket default → `https://stagechat.phone91.com` (a routing-region response still wins). |
| `hooks/notifications/notificationSocketManager.ts` | notification socket → `https://notifications.phone91.com`. This is the non-`stage` looking host; without `stage` the env var is used. |
| `components/Chatbot/hooks/HelloVoiceService.ts` | `msg91-webrtc-call` environment `'prod'` for stage and `'test'` otherwise. Looks inverted. |
| `app/chatbot/layout.tsx` | puts `environment: 'stage'` into `ChatbotContext` (nothing reads it today). |

Only `public/chat-widget-dev.js` and `public/chat-widget-local.js` copy `env=stage` from the host page URL to the iframe URL. The prod `public/chat-widget.js` never does.

> [!TODO] Needs a human: are the notification-socket and WebRTC mappings for `stage` intentionally the opposite of what the names suggest (commit 1f19031 "handling for notification socket URL" and 6de202b "add test parameter")?

## Embed script variants and hosts

Each embed script exists in three hand-maintained copies. They choose their backend by hard-coded URL, not by env var. Details and drift: [modules/embed-scripts.md](modules/embed-scripts.md).

| Script | Iframe / backend it points to |
|---|---|
| `public/chat-widget.js`, `public/chat-widget-dev.js` | Iframe, CSS and `urlMonitor.js` from the script's own origin, so the deployment that serves the file serves the widget. |
| `public/chat-widget-local.js` | `http://localhost:<port of the script URL>`. |
| `public/chatbot.js` | iframe `http://localhost:3001/chatbot` (broken for prod), CSS `https://chatbot.gtwy.ai`, login `https://db.gtwy.ai/chatbot/loginuser`. |
| `public/chatbot-dev.js` | `https://dev-chatbot.gtwy.ai`, `https://dev-db.gtwy.ai`. |
| `public/chatbot-local.js` | `http://localhost:3000`, no login URL. |
| `public/rag-prod.js` / `public/rag-dev.js` / `public/rag-local.js` | `chatbot.gtwy.ai` + `db.gtwy.ai` / `dev-chatbot.gtwy.ai` + `dev-db.gtwy.ai` / `localhost:3001` + `localhost:7072`. |

> [!TODO] Needs a human: which hostnames serve the prod and dev Hello builds (the scripts default to subdomains `blacksea` and `ctest`), and which Cloudflare Pages project and branch deploys each?

## Build and deploy

| Script | Command | Status |
|---|---|---|
| `dev` | `next dev --turbopack` | port 3000 |
| `build` | `next build` | plain Next build |
| `build:pages` | `npx @cloudflare/next-on-pages` | the Cloudflare Pages build (output in `.vercel/output/static`, the next-on-pages default) |
| `preview` | `npm run pages:build && wrangler pages dev` | **broken**: there is no `pages:build` script. 7b0909d added `pages:build`; 0a8b760 renamed it to `build:pages` but left these two callers. |
| `deploy` | `npm run pages:build && wrangler pages deploy` | **broken** for the same reason. |

- There is no wrangler.toml; the Pages project, branch and env vars are configured in the Cloudflare dashboard. [!TODO] Needs a human: confirm the Pages build command (`npm run build:pages`?) and where its env vars are set.
- `app/chatbot/page.tsx`, `app/chatbot/[chatbotId]/page.tsx` and `app/chatbotpreview/page.tsx` declare `export const runtime = 'edge'`, which next-on-pages requires for dynamic routes. Keep it on new dynamic pages.
- `next.config.ts`: `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` (commit 6bad1e6, the same day Cloudflare Pages was added in 7b0909d). **Builds never fail on type or lint errors**, so a green build proves nothing about types. `reactStrictMode: false`. `images.remotePatterns` allows any https host.
- `.eslintrc.json` turns off `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` and `react/jsx-key`, so `next lint` does not catch hook-order bugs.
- Files in `public/` are served as-is at the site root; there is no bundling or minification of the embed scripts.

## Must match other services

- The rtlayer keys hard-coded in `components/Chatbot/hooks/useRtlayerEventManager.tsx` (`useWebSocketClient`) must belong to the same rtlayer project the GTWY backend publishes to. They are not env vars; do not copy them into docs or env files.
- The CobrowseIO license key and trusted origins are hard-coded in `public/chat-widget*.js` and `hooks/coBrowser/CBManger.ts`.
- `NEXT_PUBLIC_MSG91_HOST_URL`, `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` should point at the same MSG91 environment: both sockets authenticate with the JWT from `GET /jwt-token/` on the REST host.
- `NEXT_PUBLIC_API_BASE_URL` must be the GTWY environment that issued the `interfaceToken` (from the host-page loginuser call) and the RAG `embedToken`; otherwise every call gets 401, and the 401 handler clears localStorage and reloads the iframe.
