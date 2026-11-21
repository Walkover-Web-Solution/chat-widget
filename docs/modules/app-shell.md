---
covers: ["app/**", "components/AppWrapper.tsx", "components/Chatbot-Wrapper/**", "hoc/**", "hooks/CORE/**", "hooks/HELLO/**", "utils/emitEventsToParent/**", "utils/appUtility.js", "utils/utilities.js", "utils/enums.ts", "utils/middlewareExperiments.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# App shell

The Next.js 15 app that runs inside the widget iframe: the routes, the root providers (Redux, MUI theme, `ThemeContext`), and the iframe side of the `postMessage` bridge with the host page. The sending side of that bridge is the embed script in `public/chat-widget.js` (see [embed-script](embed-script.md)); this doc covers what the iframe does with each message and what it posts back.

| File | Role |
|---|---|
| `app/layout.tsx` | Root layout. Wraps every page in `AppWrapper`. Metadata is still the create-next-app default ("Create Next App"). |
| `app/page.tsx` | Untouched create-next-app boilerplate (`Home`). Not used by the widget. |
| `app/error.tsx` | Root error boundary. "Close" posts `CLOSE_CHATBOT` to the parent. |
| `app/chatbot/page.tsx` | `InterfaceEmbed`: entry page the iframe loads. Creates the tab session id, then redirects to `/chatbot/hello`. |
| `app/chatbot/[chatbotId]/page.tsx` | Renders `ChatbotWrapper`. Only ever reached as `/chatbot/hello`; the dynamic segment is not read. |
| `components/AppWrapper.tsx` | Root providers: Redux `Provider` + `PersistGate`, MUI `ThemeProvider`, `ThemeContext` (primary colour, light/dark/system). |
| `components/Chatbot-Wrapper/ChatbotWrapper.tsx` | Mounts the two event hooks, provides `ChatContext`, posts `interfaceLoaded`, renders `Chatbot` once `chatSessionId` is set. |
| `hoc/addUrlDataHoc.tsx` | `addUrlDataHoc`: injects `chatSessionId`, composite `tabSessionId`, `searchParams` and optional per-tab fields into a component. |
| `hoc/theme.js` | `generateTheme(colorHex, mode)`: MUI theme from the widget colour. |
| `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Product-agnostic registry + `window` `message` listener for events from the embed script. |
| `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | `useHandleHelloEmbeddingScriptEvents`: the Hello handlers for every incoming event type. |
| `hooks/CORE/eventHandlers/localStorage/localStorageEventsHandler.ts` | Registry for the in-page `localstorage-updated` event + cross-tab `storage` clear detection. |
| `hooks/HELLO/eventHandlers/localStorage/localStorageEventsHandler.ts` | Syncs `k_clientId` / `a_clientId` writes into Redux. |
| `utils/emitEventsToParent/emitEventsToParent.tsx` | `emitEventToParent(type, data)` and the `ParentEventType` union. |
| `utils/utilities.js` | Widget-scoped localStorage helpers, id generators, date formatting, misc. |
| `utils/appUtility.js` | `supportsLookbehind` (used by markdown rendering); `CustomSuspense` (unused). |
| `utils/enums.ts` | `ParamsEnums` (field names for `addUrlDataHoc`), `PAGE_SIZE`, `FeedbackRatings` (unused). |
| `utils/middlewareExperiments.ts` | `mwVariant` / `mwSend`: client-side A/B experiment helpers. Not called anywhere yet. |

## How it works

### Which page the iframe loads

1. The embed script sets the iframe `src` to `${scriptOrigin}/chatbot?interfaceDetails=<{"isHelloUser":true}>`, plus `&env=stage` in the dev/local scripts when the host page has `?env=stage` (see [embed-script](embed-script.md)).
2. `app/chatbot/page.tsx:InterfaceEmbed` runs once: reads `tab_session_id` from sessionStorage (creates it as `Date.now()` if missing), dispatches `setDataInDraftReducer({ tabSessionId })`, then `router.replace('/chatbot/hello')` (keeping `?env=stage` if present). It shows only a spinner.
3. `/chatbot/hello` matches `app/chatbot/[chatbotId]/page.tsx`, which renders `ChatbotWrapper`. "hello" is the only value ever used.
4. `app/page.tsx` (`/`) is the unmodified create-next-app starter page. Nothing links to it; `app/error.tsx` falls back to `window.location.href = '/'` only when there is no parent window.

`interfaceDetails` is no longer read by any code. It was parsed by `app/chatbot/layout.tsx`, which commit 9a37b80 ("remove gtwy chatbot handling") deleted along with the GTWY AI-chatbot routes (`/chatbotpreview`, `/rag`). <!-- verify:ignore -->
Both `app/chatbot/page.tsx` and `app/chatbot/[chatbotId]/page.tsx` export `runtime = 'edge'` for the Cloudflare Pages build (`build:pages` in `package.json`).

### URL params read

| Param | Read by | Effect |
|---|---|---|
| `env` | `app/chatbot/page.tsx:InterfaceEmbed` (forwards it), and at module load in `config/regionConfig.ts`, `components/Chatbot/hooks/HelloVoiceService.ts`, `hooks/notifications/notificationSocketManager.ts` | `stage` switches API/socket hosts to staging. Only `stage` survives the redirect. |
| `interfaceDetails` | nothing | Ignored since 9a37b80. |

`hoc/addUrlDataHoc.tsx:addUrlDataHoc` does not read URL params despite its name. It reads Redux:

```ts
// props injected into the wrapped component
{
  chatSessionId: state.draftData.chatSessionId,                 // = full widget token, set by helloData
  tabSessionId: `${chatSessionId}_${state.draftData.tabSessionId}`, // key into state.appInfo
  searchParams,                                                 // next/navigation useSearchParams()
  // only the names passed in paramsToInject, from useTabData (state.appInfo[tabSessionId]):
  subThreadId?, currentChannelId?, currentChatId?, currentTeamId?
}
```

`paramsToInject` takes values from `ParamsEnums` in `utils/enums.ts`. The same composite key is built for every action by `store/index.js:getInfoParametersFromUrl` (as `action.urlData`), which is how `setDataInAppInfoReducer` knows which tab's slot to write. See [state](../ui/state.md).

### Provider tree

`app/layout.tsx` → `AppWrapper` (`Provider` → `PersistGate` → MUI `ThemeProvider` → `ThemeContext.Provider`) → page → `ChatbotWrapper` (`ChatContext.Provider` → `ReplyProvider` → `ChatbotWithHooks` → `Chatbot`).

`components/AppWrapper.tsx:AppWrapper`:
- Initial colour: `primary_color` from the `helloConfig` sessionStorage entry, else `#333333`.
- `handleThemeChange(color)` sets the colour and writes CSS vars `--primary-color` and `--primary-rgb` (space-separated RGB, for Tailwind opacity) on `<html>`.
- `handleModeChange('light'|'dark'|'system')`; `system` follows `prefers-color-scheme`. Resolved mode is written to `<html data-theme>` and the `dark` class.

### Incoming events (host page → iframe)

`ChatbotWithHooks` calls `useEmbeddingScriptEventHandler(tabSessionId, chatSessionId)`. It creates an `EmbeddingScrpitEventRegistry`, lets `useHandleHelloEmbeddingScriptEvents` register handlers on it, and adds one `window` `message` listener that dispatches on `event.data.type` if a handler is registered. Unknown types are dropped silently. Every message is `{ type, data }`.

All handlers below are in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`.

| `type` | Handler | What it does |
|---|---|---|
| `helloData` | `handleHelloData` | Boot/identify. See below. |
| `helloRunTimeData` | `handleHelloRuntimeData` | Live config: `themeColor` → `handleThemeChange`; `tagline`, `show_widget_form`, `fullScreen` → `setWidgetInfo`; `variables` → `setVariablesForHelloBot`. |
| `CHATBOT_OPEN` | `handleChatbotVisibility(true, data.id)` | appInfo `isChatbotOpen: true`, draftData `isChatbotMinimized: false`. With `data.id`, also opens that ticket (as `SHOW_TICKET`) and closes the drawer. |
| `CHATBOT_CLOSE` | `handleChatbotVisibility(false)` | appInfo `isChatbotOpen: false`, `isChatbotMinimized: false`. |
| `SHOW_TICKET` | `handleShowTicket` | Finds the channel whose `channel === data.id` in the channel list; sets appInfo `subThreadId`, `currentChannelId`, `currentChatId`, and `overrideChannelId: data.id` (set even if not found); closes the drawer. |
| `GET_TICKET_UNREAD_COUNT` | `handleGetTicketUnreadCount` | Replies `TICKET_UNREAD_COUNT` with `{ id, count }` from `widget_unread_count`; `id: '*'` sums all channels. No reply if the channel list is not loaded yet. |
| `SEND_INITIAL_MESSAGE` | `handleSendInitialMessage` | `{ message, autoSend = true, alwaysNewChat = true }`. See "Initial message" below. |
| `STARTER_QUESTION_OPTION_CLICKED` | `handleStarterQuestionOptionClicked` | Sends `data.option` as a user message via `useSendMessageToHello`. |
| `SET_VARIABLES_FOR_BOT` | `handleSetVariablesForBot` | `data.variables` (plain object only) → `setVariablesForHelloBot`. |
| `UPDATE_USER_DATA_SEGMENTO` | `handleUpdateUserDataSegmento` | Maps `name`/`mail`/`number` to `Name`/`Email`/`Phonenumber`, calls `saveClientDetails`, stores `setHelloClientInfo`, shows the widget form unless the response has all three fields. |
| `ADD_USER_EVENT_SEGMENTO` | `handleAddUserEventSegmento` | `addDomainToHello({ userEvent: data })`. |
| `parent-route-changed` | `handleParentRouteChanged` | `addDomainToHello({ domain: data.websiteUrl })` (page tracking). |
| `ADD_COBROWSE_SCRIPT` | `handleAddCoBrowseScript` | `CBManger.injectScript(data.origin)` (see [realtime](realtime.md)). |
| `SHUTDOWN_CHATBOT` | `handleShutdownChatbot` | Logout: removes `<WidgetId>_last_unique_id`, `<WidgetId>_<uniqueId>_k_clientId`, `<WidgetId>_k_clientId`, `<WidgetId>_a_clientId` and the token-scoped `k_clientId`/`a_clientId`; clears appInfo thread keys. |
| `OPEN_WITH_NOTIFICATION` | `handleOpenWithNotification` | User clicked the launcher preview. New `subThreadId` `notification-<id>`, closes drawer and form, removes the notification, inserts `data.content` as a bot `pushNotification` message. |

The embed script also sends `askAi` (from its `window.chatWidget` data API); no iframe handler is registered, so it is ignored.

`helloData` payload (keys read; the whole object is also stored):

```ts
{
  widgetToken: string,          // required
  unique_id?: string,           // known-user id; chatSessionId becomes `${widgetToken}_${unique_id}`
  mail?: string, number?: string, name?: string,
  user_jwt_token?: string,      // kept only if unique_id|mail|number is set
  theme?: 'light'|'dark'|'system',
  sdkConfig?: { customTheme?: string /* hex */, theme?: 'light'|'dark'|'system' },
  variables?: Record<string, any>,
  // ...any other widget options; saved verbatim
}
```

`handleHelloData` steps, in order:
1. `fullWidgetToken = unique_id ? widgetToken_unique_id : widgetToken`; compare with the previous `widgetToken` in sessionStorage, then save the new one there. Every later `setLocalStorage`/`getLocalStorage` key is prefixed with it.
2. Remove `is_anon`. Apply `sdkConfig.customTheme` and theme mode. Store `variables`.
3. If the token changed: clear appInfo thread keys and load `notifications` for this widget from localStorage `<fullWidgetToken>_persist:Chat` into `setNotifications`.
4. Write `userData` and `WidgetId` to (token-scoped) localStorage; dispatch `setDataInDraftReducer({ chatSessionId, widgetToken })`. This is what makes `ChatbotWithHooks` render `Chatbot`.
5. If the token changed: clear appInfo thread keys again, now under the new composite key.
6. Save the whole payload to sessionStorage `helloConfig` and `setHelloConfig`; hide the form if `mail`, `number` and `name` are all present.

### Initial message (`SEND_INITIAL_MESSAGE`)

`processInitialMessageRef` in the Hello handler:
- `alwaysNewChat: false` and the channel list is not loaded yet → queue it until `channelList` arrives. If any channel has an `id` (an existing conversation), do nothing.
- Otherwise close the drawer and clear the current thread.
- `autoSend: false` → put the text in `draftData.prefillInputMessage` (shown in the text field) and stop.
- `autoSend: true` → if `widgetInfo.company_id` is not loaded yet, queue it; then call `onSendHello({ message, newMessage, forceNewChat: true })`.

### Local-storage events

`useLocalStorageEventHandler` listens to two things:
- `localstorage-updated` (a `CustomEvent` fired by `utils/utilities.js:setLocalStorage` for keys `WidgetId`, `k_clientId`, `a_clientId`). The Hello handler copies `k_clientId` / `a_clientId` into `setHelloKeysData`. `WidgetId` has no handler.
- `storage` with `key === null` (another tab of the widget origin called `localStorage.clear()`): resets `draftData` and `appInfo` and emits `RELOAD_PARENT`, which makes the host page reload.

### Outgoing events (iframe → host page)

The full list (type, payload, sender, host effect) lives in [api](../api.md#postmessage-iframe--host-page). All go to `window.parent.postMessage(msg, '*')`. Those sent through `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent` have the shape `{ type, data }` and their type must be a member of `ParentEventType`; `ENTER_FULL_SCREEN_CHATBOT`, `EXIT_FULL_SCREEN_CHATBOT`, `hide_widget`, `launch_widget` and `initializeHelloChat_failed` are posted directly. The boot order is in [widget-boot](../flows/widget-boot.md).

### `utils/middlewareExperiments.ts`

Client-side A/B helpers added in eb0af1b. No page imports them yet.
- `mwVariant(experiment, [['control', 50], ['b', 50]])` picks a variant synchronously by hashing `experiment:visitorId` (FNV-1a + murmur finalizer). The visitor id is 16 random bytes in localStorage `mw_visitor`. On error it returns the first variant.
- `mwSend({ event: 'exposure'|'conversion', experiment, variant, goal? })` is fire-and-forget: `navigator.sendBeacon`, else `fetch` with `keepalive` and a 3 s timeout. Body: `{ key, visitor_id, event, experiment, variant, goal? }`.
- `NEXT_PUBLIC_MW_EVENTS_URL` and `NEXT_PUBLIC_MW_KEY` are inlined at build time. If either is unset, `mwSend` does nothing. One failed send disables sending for the rest of the page life. Env var details live in [environment](../environment.md).

## Contracts

- Incoming messages must be `{ type: string, data?: any }` objects. `event.data` is destructured directly, so a `null` payload throws inside the listener.
- `emitEventToParent` only accepts types in `ParentEventType`. Adding a new outgoing type means adding it there and adding a `case` in the parent's switch in all `public/chat-widget*.js` copies.
- `utils/utilities.js:setLocalStorage` / `getLocalStorage` / `removeFromLocalStorage` prefix every key with the sessionStorage `widgetToken` (`<widgetToken>_<key>`) once `helloData` has been handled. Before that they use the bare key. They go through `utils/safeStorage.ts`, so they work when storage is blocked (iOS WebViews).
- `ChatContext` (`chatSessionId`, `tabSessionId`) is read by `components/Chatbot/hooks/useHelloIntegration.ts`. `ThemeContext` is read by the Hello handlers and `useHelloEffects`.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`, and `reactStrictMode: false`.

## Gotchas

> [!WARNING]
> Event handlers are registered once (`useEffect(..., [])`) on the registry instance from the first render, so they close over first-render values. A handler that reads a prop, selector value or callback directly will see stale data. Read through a ref, as `channelListRef`, `companyIdRef`, `sendMessageToHelloRef` and `onSendHelloRef` do. `useEmbeddingScriptEventHandler` also builds a new, unused registry on every later render; only the first one is wired to the listener.

> [!WARNING]
> The iframe's `message` listener does not check `event.origin` or `event.source`. Any window that can post to the iframe can trigger `helloData`, `SHUTDOWN_CHATBOT`, `UPDATE_USER_DATA_SEGMENTO`, etc. (The parent side does check that messages come from its own iframe.)

> [!WARNING]
> `handleHelloData` must dispatch `chatSessionId` before the second `resetKeys()`. The appInfo slot key is `${chatSessionId}_${tabSessionId}`; the first reset clears the old slot, the second clears the new one (anon → known → anon reuses keys). Reordering leaves stale thread ids.

> [!WARNING]
> Opening `/chatbot/hello` directly skips `InterfaceEmbed`, so `draftData.tabSessionId` stays `""` (draftData is not persisted) and every tab shares the appInfo key `<chatSessionId>_`. Always enter through `/chatbot`.

> [!WARNING]
> `ChatbotWithHooks` renders nothing until `helloData` sets `chatSessionId`, but its event hooks are already mounted. Events that arrive before `helloData` (e.g. `SHOW_TICKET`, `GET_TICKET_UNREAD_COUNT`) run against an empty channel list and silently do nothing or reply with nothing.

> [!WARNING]
> Type and lint errors do not fail `next build` (`ignoreBuildErrors`, `ignoreDuringBuilds`). Run `npx tsc --noEmit` and `npm run lint` yourself. Also, the `preview` and `deploy` scripts call `npm run pages:build`, but the script is named `build:pages`.

## Why it is built this way

- **CORE vs HELLO.** CORE holds the product-agnostic registry and the `window` listeners; each product registers its own handlers on it. There used to be a second product: `hooks/GTWY` (the GTWY AI chatbot, with `/chatbot/<chatbot_id>`, `/chatbotpreview` and `/rag`). Commit 9a37b80 removed it, which is why `[chatbotId]` only ever sees `hello`, `interfaceDetails` is unused, and outgoing types like `FRONT_END_ACTION` / `BRIDGE_SWITCH` were dropped from `ParentEventType`. <!-- verify:ignore -->
- **Refs in the Hello handler** exist because of the register-once design above; the initial-message queueing (d4fd26b, c382f45) waits for `channelList` and `company_id` instead of re-registering handlers.
- **Notifications scoped per widget token** (64b58f1): Chat notifications persist under `<widgetToken>_persist:Chat`, so `helloData` reloads them when the token changes.
- **`safeLocalStorage`** (25f0b11) replaced direct `localStorage` because blocked WebView storage (iOS WhatsApp) threw and caused 401s.
- **Experiments never block rendering** (eb0af1b, and `docs/MODULE_CHAT_WIDGET_EXPERIMENTS.md`): variant choice is local and synchronous; sends are never awaited or retried.

> [!TODO] Needs a human: why are `ignoreBuildErrors` and `ignoreDuringBuilds` on (present since 6bad1e6, commit message ".."), and is it safe to turn them off?

> [!TODO] Needs a human: should the iframe check `event.origin` / `event.source === window.parent` on incoming messages, given customers embed it on arbitrary domains?

## Changing it safely

- **New incoming event:** add `eventHandler.addEventHandler('<TYPE>', handler)` inside the registration effect in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`. Read changing values through refs. Add the sender in every `public/chat-widget*.js` copy (prod, dev, local) and document it in [api](../api.md).
- **New outgoing event:** add the type to `ParentEventType`, call `emitEventToParent`, and add a `case` in the parent's message switch in every `public/chat-widget*.js` copy.
- **New per-tab field for components:** add it to appInfo, to `components/Chatbot/hooks/useTabData.ts`, and to `ParamsEnums`; then pass it in `addUrlDataHoc(Component, [ParamsEnums.x])`.
- **Theme changes:** go through `ThemeContext.handleThemeChange` / `handleModeChange`; do not set `--primary-color` directly, or MUI and Tailwind colours diverge.
- Check by loading a host page with the local script (`public/chat-widget-local.js`), watching the iframe console for handler effects and the host page for returned events. There are no automated tests for this area.
