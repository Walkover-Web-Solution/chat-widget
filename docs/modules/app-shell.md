---
covers: ["app/layout.tsx", "app/page.tsx", "app/error.tsx", "app/globals.css", "app/chatbot/**", "store/index.js", "store/combineReducer.js", "store/rootSaga.ts", "store/useTypedHooks.ts", "store/appInfo/**", "hoc/**", "components/AppWrapper.tsx", "components/context.tsx", "utils/**", "config/regionConfig.ts", "next.config.ts", "tailwind.config.ts", "types/*.ts", "package.json"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# App shell

The Next.js 15 App Router shell that the host-page iframe loads: routes, the provider stack (`components/AppWrapper.tsx`), the Redux store (persist + cross-tab sync + saga), the per-tab session key that every slice action carries, theme, region-aware base URLs, shared utilities, and the build/deploy setup for Cloudflare Pages. Everything else in the widget renders inside this shell.

| File | Role |
|---|---|
| `app/layout.tsx` | Root layout (server component). Sets `<html data-theme="light">`, Geist fonts, wraps children in `AppWrapper`. Metadata is still the create-next-app default. |
| `app/page.tsx` | `/`: unmodified create-next-app landing page. Not used by the widget, but the 401 handler redirects here (see Gotchas). |
| `app/error.tsx` | Route error boundary. "Try again" calls `reset()`; "Close" posts `{ type: "CLOSE_CHATBOT" }` to `window.parent`. |
| `app/globals.css` | Tailwind + daisyui, hides all scrollbars, CSS vars (`--background`, `--message-card-background`, `--drawer-color`, …) for `:root` and `[data-theme="dark"]`. |
| `app/chatbot/layout.tsx` | Parses the `interfaceDetails` and `env` query params, provides `ChatbotContext`, writes GTWY identity into `appInfo`. Wrapped in `addUrlDataHoc`. |
| `app/chatbot/page.tsx` | `/chatbot` (edge): the iframe entry. Creates `tab_session_id`, verifies, then `router.replace` to `/chatbot/<chatbot_id>` or `/chatbot/hello`. |
| `app/chatbot/[chatbotId]/page.tsx` | `/chatbot/[chatbotId]` (edge): renders `components/Chatbot-Wrapper/ChatbotWrapper.tsx`. The param is never read. |
| `components/AppWrapper.tsx` | Redux `Provider` → `PersistGate` → MUI `ThemeProvider` → `ThemeContext`. Owns theme color and light/dark/system mode. |
| `components/context.tsx` | `ChatbotContext` default shape (provided by the chatbot layout). |
| `hoc/addUrlDataHoc.tsx` | HOC injecting `chatSessionId`, `tabSessionId`, chosen `appInfo` fields and `searchParams` as props. |
| `hoc/theme.js` | `generateTheme(colorHex, mode)`: MUI theme using one color for primary and secondary. |
| `store/index.js` | `configureStore`, `customMiddleware` (attaches `action.urlData`), root persist config, redux-state-sync, saga. Exports `store`, `persistor`, `initializeStore`. |
| `store/combineReducer.js` | Five slices and their nested persist configs. |
| `store/rootSaga.ts` | Forks `InterfaceSaga` and `HelloSaga`. |
| `store/useTypedHooks.ts` | `useAppSelector` / `useAppDispatch`. Defined but unused; the repo uses `utils/deepCheckSelector.ts:useCustomSelector`. |
| `store/appInfo/appInfoSlice.ts`, `store/appInfo/appInfoReducer.ts` | Per-tab session state (`setDataInAppInfoReducer`, `resetAppInfoReducer`, and a `setThreads` extra-reducer that picks `subThreadId`). |
| `types/reduxCore.ts` | `$ReduxCoreType`, `$DraftDataReducerType`. |
| `types/utility.ts` | `actionType<T>` (payload + `urlData`) and `UrlDataType` (mostly legacy keys). |
| `config/regionConfig.ts` | In-memory Hello REST and socket base URLs, overridden by the routing-region response. |
| `utils/storageUtility.ts` | redux-persist storages: `STORAGE_OPTIONS.local/session`, `createNoopStorage`, `createWidgetScopedLocalStorage`. |
| `utils/ChatbotUtility.ts` | `SetSessionStorage` / `GetSessionStorageData` (try/catch, `widgetToken` backed up to localStorage), `perFormAction`, `toggleSidebar`. |
| `utils/utilities.js` | Widget-scoped `setLocalStorage` / `getLocalStorage` / `removeFromLocalStorage`, cookies, `formatTime` (dayjs), `generateNewId`, `generateChannelId`, `linkify`, `splitNumber`, `extractSessionId`. |
| `utils/interceptor.ts` | axios for GTWY and RAG calls (`config/api.ts`, `config/ragApi.ts`): adds `Authorization` or `proxy_auth_token`; 401/5xx handling. |
| `utils/helloInterceptor.ts` | axios for Hello calls; the response error handler is commented out. |
| `utils/deepCheckSelector.ts` | `useCustomSelector` = `useSelector` with a deep-equal comparator. Use it for object-returning selectors. |
| `utils/emitEventsToParent/emitEventsToParent.tsx` | `emitEventToParent(type, data)` → `window.parent.postMessage({type, data}, "*")`; `ParentEventType` lists the allowed types. |
| `utils/enums.ts` | `EmbedVerificationStatus`, `ParamsEnums` (keys for `addUrlDataHoc`), `PAGE_SIZE`, `EMIT_EVENTS`, `FeedbackRatings`, KB section enums. |
| `utils/themeUtility.js` | `isColorLight`, `getGradientBackground`, `withAlpha` (canvas-based color parsing, browser only). |
| `utils/readMore.ts` | Contract for server-truncated messages (`SHOW_MORE_FIELD = "show_more"`). |
| `utils/preSubscribedChannels.ts` | Module-level set: `markPreSubscribed` / `consumePreSubscribed` to skip one history fetch after early socket subscribe. |
| `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` | Converts GTWY/Hello history and socket events to one message format; builds send payloads. Documented in [hello](../integrations/hello.md). |
| `utils/appUtility.js`, `utils/router-utility.tsx` | `CustomSuspense`, `supportsLookbehind`; `lazyWithPreload` (unused). |
| `next.config.ts` | `reactStrictMode: false`, any-host remote images, ESLint and TypeScript errors ignored during build. |
| `tailwind.config.ts` | Dark mode by `class` or `[data-theme="dark"]`; `primaryTheme` color from `--primary-rgb`; daisyui light/dark/cupcake. |

## How it works

### Routes

| Route | Runtime | Purpose |
|---|---|---|
| `/` | default | Next boilerplate. Unused. |
| `/chatbot` | edge | What the iframe loads: `public/chat-widget*.js` (Hello) and `public/chatbot*.js` (GTWY) set `iframe.src = <origin>/chatbot?interfaceDetails=<urlencoded JSON>`. See [embed-scripts](embed-scripts.md). |
| `/chatbot/[chatbotId]` | edge | The actual widget. GTWY lands on `/chatbot/<chatbot_id>`; Hello lands on `/chatbot/hello` (literal segment `hello`). |
| `/chatbotpreview` | edge | Static UI preview that takes `themeColor` by postMessage. See [interface-renderer](interface-renderer.md). |
| `/rag` | default | Knowledge-base embed page. |

Full route table: [ui/routes](../ui/routes.md). Boot sequence end to end: [widget-boot](../flows/widget-boot.md).

### Boot inside the shell

1. `app/layout.tsx` renders `AppWrapper`. Importing `store/index.js` creates the store and `persistor` at module load; `PersistGate loading={null}` renders nothing until rehydration finishes.
2. `app/chatbot/layout.tsx:ChatbotLayout` parses `interfaceDetails` once (`useMemo` with `[]`). Missing, `"undefined"` or bad JSON gives `{ chatbot_id: null, userId: null, token: null, config: null, isHelloUser: false }`. It reads `env` and keeps it only if it equals `stage`.
3. `app/chatbot/page.tsx:InterfaceEmbed` runs:
   - reads or creates `sessionStorage.tab_session_id` (`Date.now()`), dispatches `setDataInDraftReducer({ tabSessionId })`;
   - GTWY (`token` present): stores `interfaceToken` and `interfaceUserId` in sessionStorage, marks VERIFIED, `isHelloUser: false`;
   - Hello (`isHelloUser`): marks VERIFIED;
   - once VERIFIED: GTWY dispatches `{ chatbotId, chatSessionId: chatbot_id }` and replaces to `/chatbot/<chatbot_id>`; Hello replaces to `/chatbot/hello` and appends `?env=stage` if set.
4. The layout dispatches `setDataInAppInfoReducer({ chatBotId, userId, config })` when `chatbot_id && userId`. `chatSessionId` (a prop from `addUrlDataHoc`) is in the effect deps so the write repeats once the session key exists.
5. For Hello, `chatSessionId` is set later by `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` to the widget token (`<widgetToken>` or `<widgetToken>_<unique_id>`) when the host sends the widget config by postMessage.

### Session keys: `chatSessionId`, `tabSessionId`, `urlData`

`appInfo` holds one object per iframe tab, keyed `` `${chatSessionId}_${tabSessionId}` ``. `chatSessionId` is the GTWY `chatbot_id` or the Hello widget token; `tabSessionId` is the per-tab `Date.now()` from sessionStorage.

`store/index.js:customMiddleware` runs before every reducer and sets `action.urlData = getInfoParametersFromUrl(store)` unless the action already has one:

```js
action.urlData = {
  chatSessionId: draftData.chatSessionId,
  tabSessionId: `${chatSessionId}_${draftData.tabSessionId}`,   // the appInfo key
  ...appInfo[thatKey]   // threadId, bridgeName, subThreadId, currentChannelId, userId, config, ...
}
```

Reducers in every slice read `action.urlData` instead of taking ids in the payload. `setDataInAppInfoReducer` merges its payload into `appInfo[urlData.tabSessionId]`; with no key it returns `undefined`.

Shape of one `appInfo` entry (`types/appInfo/appInfoReduxType.ts`, all fields optional in practice):

```ts
{ threadId, subThreadId, bridgeName, versionId, userId, config, helloId,
  currentChannelId, currentChatId, currentTeamId, overrideChannelId?,
  isChatbotOpen, hideFullScreenButton, hideCloseButton, callToken,
  serviceChanged, modelChanged, demoSessionId?, showNotificationView? }
```

### `addUrlDataHoc`: what it injects

The name is historical. It does **not** map URL query params to store keys. It passes these props to the wrapped component:

- `chatSessionId` and `tabSessionId` (the composite key) from `draftData`;
- for each name in its second argument (use `ParamsEnums` from `utils/enums.ts`), the value from `appInfo[tabSessionId]` via `components/Chatbot/hooks/useTabData.ts`. Only `threadId`, `bridgeName`, `subThreadId`, `userId`, `config`, `currentChannelId`, `currentChatId`, `currentTeamId` are available; any other name injects `undefined`;
- `searchParams` from `useSearchParams()`.

Example: `components/Interface-Chatbot/ChatbotHeader.tsx` is exported as `addUrlDataHoc(ChatbotHeader, [ParamsEnums.currentTeamId, ParamsEnums.currentChannelId, ParamsEnums.threadId, ParamsEnums.bridgeName])`.

The only query params the app reads are `interfaceDetails` and `env` (in `app/chatbot/layout.tsx`, `config/regionConfig.ts`, `components/Chatbot/hooks/HelloVoiceService.ts`, `hooks/notifications/notificationSocketManager.ts`).

### Store

Slices (`store/combineReducer.js`) and where each persists:

| Key | Slice | Persisted to | Synced across tabs |
|---|---|---|---|
| `Interface` | `store/interface/` | localStorage `persist:root` | yes |
| `Hello` | `store/hello/` | localStorage `persist:root` | yes, except `Hello/setUnReadCount` without `resetCount` |
| `Chat` | `store/chat/` | only `notifications`, localStorage key `<widgetToken>_persist:Chat` | no |
| `draftData` | `store/draftData/` | not persisted | no |
| `appInfo` | `store/appInfo/` | sessionStorage `persist:appInfo` | no |

- Root config: `{ key: "root", storage: STORAGE_OPTIONS.local, version: 1, blacklist: ["appInfo", "draftData", "Chat"] }`. `appInfo` and `Chat` have their own nested `persistReducer`.
- Middleware order: default (`serializableCheck: false`) → `customMiddleware` → saga → `createStateSyncMiddleware` (client only). `initMessageListener(store)` receives other tabs' actions on BroadcastChannel `crossTabChannel`.
- `crossTabSyncConfig.predicate` skips redux-persist actions, every `appInfo/*`, `draftData/*` and `Chat/*` action, and unread-count increments. Synced actions keep the sender's `urlData`, so `customMiddleware` does not overwrite it (it logs `SYNCING CROSS TAB REDUX STORE`).
- On the server (`typeof window === "undefined"`) every storage is `createNoopStorage()` and state-sync is left out.

Details of the slices: [ui/state](../ui/state.md), [hello](../integrations/hello.md).

### React context and non-Redux state

- `ThemeContext` (`components/AppWrapper.tsx`): `themeColor`, `themeMode`, `handleThemeChange`, `handleModeChange`.
- `ChatbotContext` (`components/context.tsx`, provided by `app/chatbot/layout.tsx`): `chatbotConfig`, `chatbot_id`, `userId`, `token`, `themeColor`, `onConfigChange`, `toggleHideCloseButton`, `isHelloUser`, `environment`.
- `ChatContext` in `components/Chatbot-Wrapper/ChatbotWrapper.tsx` and `ReplyContext` hold tree-local state.
- Call state lives in the `HelloVoiceService.getInstance()` singleton (`components/Chatbot/hooks/HelloVoiceService.ts`), not Redux. See [hello](../integrations/hello.md).
- Module-level state: `config/regionConfig.ts` URLs, `utils/preSubscribedChannels.ts`.

### Theme

1. Initial color: `primary_color` from sessionStorage `helloConfig`, else `#333333`. Mode starts `light`.
2. Color updates via `handleThemeChange`: GTWY `interfaceDetails.config.themeColor` (layout `onConfigChange`, default `#000000`); Hello SDK `customTheme` and runtime `themeColor` (embedding-script handler); widget-info `primary_color` (`components/Chatbot/hooks/useHelloEffects.ts`); `/chatbotpreview` postMessage.
3. Mode updates via `handleModeChange('light' | 'dark' | 'system')` from the Hello SDK `theme` field. `system` follows `prefers-color-scheme`.
4. `AppWrapper` then sets `data-theme` and the `dark` class on `<html>`, CSS vars `--primary-color` and `--primary-rgb`, and rebuilds the MUI theme with `generateTheme`. Tailwind `primaryTheme` / `secondaryTheme` read `--primary-rgb`.

### Region and stage hosts

`config/regionConfig.ts` keeps two module variables, empty at load:

| Getter | Default (no `env`) | Default (`?env=stage`) | Override |
|---|---|---|---|
| `getHelloHostUrl()` | `NEXT_PUBLIC_MSG91_HOST_URL` | `https://stageapi.phone91.com` | `region_url` from routing-region |
| `getSocketUrl()` | `NEXT_PUBLIC_SOCKET_URL` | `https://stagechat.phone91.com` | `socket_url` from routing-region |

`config/helloApi.ts:getRoutingRegion` posts to `${HELLO_HOST_URL()}/routing-region/` first on every mount and calls `setRegionUrls(region_url, socket_url)`; when it returns `true`, `socketManager.reconnect()` moves the socket. The region is not persisted on purpose (comment at the top of the file: it is re-resolved on every mount, so a stored value could only be stale). The actual regional host list comes from the backend; this repo has none. Env var meanings: [environment](../environment.md).

### Storage and "storage blocked"

All widget localStorage keys are prefixed with the session `widgetToken` (`utils/utilities.js:setLocalStorage`, `createWidgetScopedLocalStorage`). In iOS in-app browsers (WhatsApp, Instagram) the cross-origin iframe can be reloaded and lose sessionStorage while localStorage survives; losing `widgetToken` made reads use unprefixed keys and send `Authorization: null:null`. The current fix (`utils/ChatbotUtility.ts`, `SESSION_KEYS_BACKED_BY_LOCAL`): `SetSessionStorage('widgetToken', …)` also writes `localStorage.__session_backup_widgetToken`, and `GetSessionStorageData` restores from it when sessionStorage is empty. Both helpers catch storage exceptions and log. <!-- verify:ignore -->

## Contracts

- Every Redux action gets `urlData` from `customMiddleware`. Reducers depend on it; a reducer called outside the store (tests, `extraReducers` replay) has no session key.
- `draftData.chatSessionId` and `draftData.tabSessionId` must both be set before any `appInfo` write lands under the right key.
- `/chatbot` must stay the iframe entry and must accept `interfaceDetails` as URL-encoded JSON: `{ isHelloUser: true }` (Hello) or the GTWY embed response with `chatbot_id`, `userId`, `token`, `config`.
- `sessionStorage` keys set here: `tab_session_id`, `interfaceToken`, `interfaceUserId`; read here: `helloConfig`, `widgetToken`. `utils/interceptor.ts` sends `interfaceToken` as `Authorization` (or `ragToken` as `proxy_auth_token` when the URL contains `rag`).
- `emitEventToParent` types must be in `ParentEventType`; the host scripts switch on them ([api](../api.md)).

## Gotchas

> [!WARNING]
> `next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. A green `next build` proves nothing about types. Run `npx tsc --noEmit` yourself. `.eslintrc.json` also turns off `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`.

> [!WARNING]
> `npm run preview` and `npm run deploy` call `npm run pages:build`, which does not exist. The Cloudflare build script is `build:pages` (`npx @cloudflare/next-on-pages`). There is no `wrangler.toml` and no `.env.example` in the repo. <!-- verify:ignore -->

> [!WARNING]
> `utils/interceptor.ts` on any 401 runs `localStorage.clear()` (wiping every widget's persisted state for this origin, not just the current one) and navigates the iframe to `/?error=session expired`, which is the unused Next boilerplate page.

> [!WARNING]
> `setDataInAppInfoReducer` dispatched before `chatSessionId`/`tabSessionId` exist writes under a key like `_<tab>` or `<id>_` and is never read again. It does not throw.

> [!WARNING]
> `Hello` and `Interface` persist under the shared `persist:root` key with no widget-token prefix, unlike `Chat`. Switching widget tokens in one browser relies on the reset logic in the Hello embedding-script handler, not on storage scoping.

> [!WARNING]
> Adding a new slice: it will persist to `persist:root` and sync across tabs unless you add it to the root `blacklist` and to `crossTabSyncConfig.predicate`. Per-tab data must go in `appInfo` or `draftData`.

> [!WARNING]
> `interfaceDetails` and `env` are parsed once per mount (`useMemo([])`) and `config/regionConfig.ts` reads `env` at module load. Changing them requires a new iframe URL.

> [!WARNING]
> `utils/utilities.js` imports `nanoid`, which is not listed in `package.json` (no lockfile is committed). It only works if a dependency installs it transitively; add it explicitly if the build fails to resolve it.

## Why it is built this way

- `initializeStore` splits server and client because redux-state-sync uses BroadcastChannel and breaks during SSR (commit e0f1253 "handling redux state sycn (#307)"). The same commit made `getInfoParametersFromUrl` read state through the middleware's `storeAPI` instead of the module-level `store`.
- `appInfo` is in sessionStorage and keyed per tab so two tabs of the same widget can show different threads/channels; it is excluded from cross-tab sync for the same reason.
- `Chat` persists only `notifications`, scoped by widget token (64b58f1, 9253b0c), so notifications survive reloads without leaking between widgets.
- Region URLs are in memory only (comment in `config/regionConfig.ts`); added in a3cbac3 "region-wise api calling (#458)". Background: `docs/brainstorms/region-wise-routing-requirements.md`.
- Storage blocked: PR #472 (47d5e4a) added an in-memory `safeStorage` fallback for every local/session read and write; it was reverted the same day by #474 (542cc80). PR #473 (69e0bc5, branch `bugfix/test/storage-blocked-issue-v2`) shipped the narrower fix: back up only `widgetToken` to localStorage. The same commit (76c0a32) is on `react-main` (production) via branch `bugfix/react-main/storage-blocked-issue-v2`. <!-- verify:ignore -->

> [!TODO] Needs a human: why was the in-memory `safeStorage` fallback (#472) reverted? If storage is fully blocked (not just reset), `widgetToken` is still lost. <!-- verify:ignore -->

> [!TODO] Needs a human: which Cloudflare Pages project and branch map to `test` and `react-main`, and how deploys are triggered given the broken `preview`/`deploy` scripts.

## Changing it safely

- New per-tab field: add it to `types/appInfo/appInfoReduxType.ts`, write it with `setDataInAppInfoReducer`, read it with `useCustomSelector((s) => s.appInfo[tabSessionId]?.field)`. To expose it through `addUrlDataHoc`, add it to `ParamsEnums` **and** to the selector in `components/Chatbot/hooks/useTabData.ts`.
- New query param: parse it in `app/chatbot/layout.tsx` and pass it through `ChatbotContext`; also forward it from `/chatbot` to `/chatbot/hello` in `app/chatbot/page.tsx` (only `env` is forwarded today), and add it in each `public/chat-widget*.js` variant ([embed-scripts](embed-scripts.md)).
- New page: add `export const runtime = "edge"` for any dynamic route, otherwise `@cloudflare/next-on-pages` fails the build. Keep code edge-safe (no Node APIs).
- New backend host: read it through an env var or the `config/regionConfig.ts` getters, never a literal; document it in [environment](../environment.md).
- Check: `npx tsc --noEmit`, `npm run lint`, `npm run build:pages`, then load `/chatbot?interfaceDetails=%7B%22isHelloUser%22%3Atrue%7D` through a `public/chat-widget-local.js` host page and confirm two tabs keep separate `persist:appInfo` entries in sessionStorage.
