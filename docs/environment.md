---
covers: ["config/regionConfig.ts", "config/helloApi.ts", "hooks/notifications/notificationSocketManager.ts", "utils/middlewareExperiments.ts", "next.config.ts", "package.json"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Environment

The widget is a browser-only Next.js 15 app (React 19). It has no server code, database or secrets of its own; configuration is six NEXT_PUBLIC_ env vars plus a runtime `?env=stage` switch. The app is built for Cloudflare Pages with `@cloudflare/next-on-pages`.

> [!WARNING]
> Every variable here is NEXT_PUBLIC_: Next.js inlines its value into the browser bundle at **build time**. Changing a value needs a rebuild and redeploy, the value is readable by anyone who loads the widget, and setting it only at runtime on Cloudflare does nothing. Never put a secret in one.

There is no .env.example and no committed env file (`.gitignore` ignores every .env file). Ask a maintainer for the values; this page lists names and effects only.

## Run it locally

1. Node: `package.json` has no `engines` field and the repo has no `.nvmrc`. Next 15.1.6 needs Node 18.18 or newer.
2. `npm install` (no lockfile is committed: `.gitignore` lists package-lock.json, so versions float within the `package.json` ranges).
3. Create .env.local with the variables below. For stage testing you can skip the Hello and chat-socket hosts by using `?env=stage` (see [The `?env=stage` switch](#the-envstage-switch)).
4. `npm run dev` runs `next dev --turbopack` on `http://localhost:3000`.
5. To see the widget as a customer would, serve a plain HTML page from another port that loads `http://localhost:3000/chat-widget-local.js` and calls `window.initChatWidget({ widgetToken: '<a widget token>' })`. The local script uses the script port as its "subdomain" and points the iframe, stylesheet and `public/urlMonitor.js` at `http://localhost:<that port>`, so load it from `localhost`, not `127.0.0.1`. Add `?env=stage` to the host page URL to pass the stage switch into the iframe.
6. `npm run lint` runs `next lint`. There is no test script.

> [!WARNING]
> `next build` succeeds with type and lint errors: `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` (since 6bad1e6, no reason recorded). Run `npx tsc --noEmit` and `npm run lint` yourself before shipping.

`public/chat-widget-local.js` has drifted from the production script; for differences, see [embed-script](modules/embed-script.md#prod-dev-and-local-copies).

## Build and deploy

| Script | Command | Notes |
|---|---|---|
| `build` | `next build` | Plain Next.js build. |
| `build:pages` | `npx @cloudflare/next-on-pages` | Cloudflare Pages build. Both chatbot pages export `runtime = 'edge'` for it. |
| `preview` | `npm run pages:build && wrangler pages dev` | **Broken:** calls `pages:build`, which was renamed to `build:pages` in 0a8b760. |
| `deploy` | `npm run pages:build && wrangler pages deploy` | **Broken** for the same reason. |
| `start` | `next start` | Serves a `next build` output. |

Other build settings in `next.config.ts`: `reactStrictMode: false`; `images.remotePatterns` allows any `https` host. The `setupDevPlatform` call for local Cloudflare bindings is commented out, and there is no wrangler config file in the repo.

> [!TODO] Needs a human: how is production actually built and deployed (Cloudflare Pages dashboard build command, project name, where the NEXT_PUBLIC_ values are set), given `preview`/`deploy` cannot run?

## Variables

| Var | Required | Default | Read in | Purpose / effect if missing |
|---|---|---|---|---|
| `NEXT_PUBLIC_MSG91_HOST_URL` | yes (prod) | none; `https://stageapi.phone91.com` with `?env=stage` | `config/regionConfig.ts:DEFAULT_HELLO_HOST_URL` | Default Hello REST host, used until `routing-region` returns `region_url` (and for `routing-region` itself). Missing: `getHelloHostUrl` returns `''`, calls go to relative paths on the widget origin and fail, `widget-info` fails, the iframe posts `initializeHelloChat_failed` and the host page removes the widget. |
| `NEXT_PUBLIC_SOCKET_URL` | yes as fallback | none; `https://stagechat.phone91.com` with `?env=stage` | `config/regionConfig.ts:DEFAULT_SOCKET_URL` | Default chat-socket host. Used only when `routing-region` gives no `socket_url` or fails. Missing then: socket.io connects to the widget origin and real-time messages never arrive. |
| `NEXT_PUBLIC_PUSH_NOTIFICATION_URL` | only for mobile SDK push | none | `config/helloApi.ts:PUSH_NOTIFICATION_URL` | Host for `subscribeForFCMPushNotification` (`POST <url>/add-user-fcm-token/`), called only with `isMobileSDK` and a `pushConfig` token. Missing: the request goes to "undefined/add-user-fcm-token/" and throws. Not region-routed; no stage override. |
| `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` | optional (feature) | none; `https://notifications.phone91.com` with `?env=stage` | `hooks/notifications/notificationSocketManager.ts` (module-level `socketUrl`) | Notification socket for push popups and launcher previews. Note the typo `NOTIFICATOIN`: it is the real name, do not "fix" it in one place. Missing: push notifications never arrive; chat still works. |
| `NEXT_PUBLIC_MW_EVENTS_URL` | optional | `''` | `utils/middlewareExperiments.ts:MW_EVENTS` | A/B experiment event endpoint. If it or `NEXT_PUBLIC_MW_KEY` is empty, `mwSend` does nothing and `mwVariant` still works. No code calls these helpers yet. |
| `NEXT_PUBLIC_MW_KEY` | optional | `''` | `utils/middlewareExperiments.ts:MW_KEY` | Public key sent in every experiment event body. Same effect if missing. |
| `NODE_ENV` | no | set by Next.js | `next.config.ts` (commented-out code only) | Nothing reads it at this commit. |

`config/regionConfig.ts` resolves the Hello and socket hosts per call, so a region from `routing-region` overrides both env defaults. See [hello-api](integrations/hello-api.md#region-routing).

## The `?env=stage` switch

A runtime switch, not an env var. It is read from the **iframe** URL (`window.location.search`) once, at module load, in four places:

| Where | Normal | With `env=stage` |
|---|---|---|
| `config/regionConfig.ts:DEFAULT_HELLO_HOST_URL` | `NEXT_PUBLIC_MSG91_HOST_URL` | `https://stageapi.phone91.com` (hard-coded) |
| `config/regionConfig.ts:DEFAULT_SOCKET_URL` | `NEXT_PUBLIC_SOCKET_URL` | `https://stagechat.phone91.com` (hard-coded) |
| `hooks/notifications/notificationSocketManager.ts` | `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` | `https://notifications.phone91.com` (hard-coded, 1f19031) |
| `components/Chatbot/hooks/HelloVoiceService.ts:WebRTC_environment` | `'test'` | `'prod'` (looks inverted; see [voice-calling](modules/voice-calling.md#gotchas)) |

How it gets there: `public/chat-widget-dev.js` and `public/chat-widget-local.js` copy `env=stage` from the host page URL onto the iframe URL; the production `public/chat-widget.js` does not. `app/chatbot/page.tsx:InterfaceEmbed` keeps it across the redirect to `/chatbot/hello`; any other `env` value is dropped.

> [!WARNING]
> A region returned by `routing-region` still wins over the stage defaults, so stage only controls the first call and any fallback. The stage notification host has no `stage` in its name.

> [!TODO] Needs a human: is `https://notifications.phone91.com` the stage notification server or the production one, and is the `env=stage` → WebRTC `'prod'` mapping intended?

Other hard-coded values that behave like config: the CobrowseIO license key and a `http://localhost:3001/chatbot` trusted origin in the `CobrowseManager` of each `public/chat-widget*.js` (see [embed-script](modules/embed-script.md#gotchas)).

## Must match other services

- The embed script must be served from the same deployment as the app: `public/chat-widget.js` loads the iframe, stylesheet and `public/urlMonitor.js` from its own script origin, and its first DNS label is the widget namespace (`blacksea` and `ctest` are the legacy ones).
- `NEXT_PUBLIC_MSG91_HOST_URL` and `NEXT_PUBLIC_SOCKET_URL` must belong to the same Hello environment; mixing them pairs the REST backend with a socket server from another environment.
