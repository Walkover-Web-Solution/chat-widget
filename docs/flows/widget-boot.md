---
covers: ["public/chat-widget.js", "public/chat-widget-dev.js", "public/chat-widget-local.js", "app/layout.tsx", "app/chatbot/**", "components/AppWrapper.tsx", "hoc/addUrlDataHoc.tsx", "components/Chatbot-Wrapper/ChatbotWrapper.tsx", "hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts", "hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts", "components/Chatbot/Chatbot.tsx", "components/Chatbot/hooks/useHelloEffects.ts", "components/Chatbot/hooks/useHelloIntegration.ts", "components/Chatbot/hooks/useReduxEffects.ts", "components/Chatbot/hooks/useReduxManagement.ts", "config/helloApi.ts", "config/regionConfig.ts", "hooks/socket.js", "hooks/socketManager.js", "hooks/notifications/notificationSocket.ts", "utils/utilities.js", "utils/emitEventsToParent/emitEventsToParent.tsx", "store/index.js", "store/combineReducer.js", "store/hello/helloReducer.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Flow: widget boot

A host page loads `public/chat-widget.js` and calls `window.initChatWidget(...)`; the result is a hidden iframe running `/chatbot/hello` that has resolved its Hello region, identified the visitor, connected both sockets and posted the launcher/badge state back to the host. The flow ends when the widget sits idle waiting for a click or a socket event.

Module detail lives elsewhere; this page is the end-to-end order. Embed script internals: [embed-script](../modules/embed-script.md). Iframe routes and the event bridge: [app-shell](../modules/app-shell.md). Each Hello call: [hello-api](../integrations/hello-api.md#init-sequence). Socket lifecycle: [realtime](../modules/realtime.md#chat-socket-connection-lifecycle). Redux persistence and keys: [state](../ui/state.md).

```mermaid
sequenceDiagram
  participant H as Host page
  participant E as Embed script (chat-widget.js)
  participant I as Iframe (/chatbot → /chatbot/hello)
  participant A as Hello API
  participant S as Chat + notification sockets
  H->>E: <script src=".../chat-widget.js">
  E->>E: new HelloChatbotEmbedManager, message listener, initializeChatbot
  E->>H: append hidden launcher, stylesheet, hidden iframe container
  E->>I: iframe.src = /chatbot?interfaceDetails=...[&env=stage]
  H->>E: window.initChatWidget(data, delay)
  E->>E: helloProps = data; setTimeout(delay) → delayElapsed
  I->>I: /chatbot: tab_session_id → draftData.tabSessionId, replace → /chatbot/hello
  I->>I: ChatbotWithHooks registers window "message" handlers
  I-->>E: postMessage interfaceLoaded
  E->>E: showIconIfReady (needs interfaceLoaded AND delayElapsed)
  E-->>I: postMessage helloData (helloProps) [+ CHATBOT_OPEN if container visible]
  I->>I: handleHelloData: sessionStorage widgetToken/helloConfig, localStorage userData/WidgetId, draftData.chatSessionId
  I->>I: <Chatbot/> mounts; useSocket may connect with a persisted JWT
  I->>A: POST /routing-region/
  A-->>I: region_url, socket_url (region change → socketManager.reconnect)
  I->>A: POST /widget-info/
  I-->>E: initializeHelloChat_failed (if null), hide_widget, setDataInLocal widgetInfo, launch_widget (if true)
  alt anonymous visitor, no client id
    I->>A: POST /anonymous-client-details/ → a_clientId
  else known user or returning visitor
    I->>A: POST /pubnub-channels/list/ → uuid → k_clientId / a_clientId, channels
  end
  I-->>E: uuid (co-browse device id)
  I->>A: GET /jwt-token/ → setJwtToken
  I->>S: connect(jwt); subscribe user channel, channel list, event_channels; notification channel
  I->>A: greeting (lex/chatgpt), POST /agent-team/, web-rtc client token (if voice_call_widget)
  I-->>E: SHOW_STARTER_QUESTION (no chats yet), SET_BADGE_COUNT, ENABLE_DOMAIN_TRACKING
  E-->>I: parent-route-changed {websiteUrl} → PUT /add-domain/
```

## Steps

### Host page and embed script

1. **Script runs** — `public/chat-widget.js` (IIFE)
   Finds its own `<script>` (`document.currentScript` or `script[src*="chat-widget"]`; returns with a console error if neither has a `src`). `subdomain` = first DNS label of the script host, or the port on `localhost`; `scriptOrigin` = script origin.
2. **Manager created** — `public/chat-widget.js:HelloChatbotEmbedManager`
   Constructor builds element ids (`<subdomain>-hello-…`, or `hello-…` for `isLegacySubdomain`), then `initializeEventListeners`: `observeScriptChanges` (removing the script tag runs `cleanupChatbot`), `setupMessageListeners`, `setupResizeObserver`. The instance is stored on `window[<subdomain>_helloChatbotManager]`.
3. **Window API exposed** — `window.chatWidget[subdomain]` and `window.initChatWidget` (both route to `subdomainInitFunction`). Full API: [embed-script](../modules/embed-script.md#window-api-and-postmessage-events).
4. **DOM built** — `initializeChatbot` → `loadContent` (now if `document.body` exists, else on `DOMContentLoaded`; guarded by `state.bodyLoaded`)
   Appends the launcher (`createChatbotIcon`, `display:none`), the stylesheet link (`createStyleLink` → `<scriptOrigin>/chat-widget-style.css`), and the iframe container (`createIframeContainer`, `display:none`, sandboxed iframe with mic/camera allow).
5. **Iframe src set** — `loadChatbotEmbed` → `processChatbotDetails`
   `src = <scriptOrigin>/chatbot?interfaceDetails=%7B%22isHelloUser%22%3Atrue%7D`. Branch: in `public/chat-widget-dev.js` and `public/chat-widget-local.js` only, if the host page URL has `?env=stage`, `&env=stage` is appended. The prod script never forwards it.
6. **Host calls `initChatWidget(data, delay = 0)`** — `subdomainInitFunction`
   Returns at once if `block_chatbot` (set by an earlier widget-info failure). Otherwise: `previewLinks` → `addUrlMonitor`; `helloProps = { ...data }`; `hide_launcher` key → `hideHelloIcon`; `launch_widget` key → `helloLaunchWidget`; `variables` → posts `SET_VARIABLES_FOR_BOT` now (may arrive before the iframe listens; `helloData.variables` covers it later); `parentId` → `SendDataToBot` re-parents the container. Then `setTimeout(delay)` sets `state.delayElapsed` and calls `showIconIfReady`.

### Iframe app

7. **Providers mount** — `app/layout.tsx` → `components/AppWrapper.tsx`
   Redux `Provider` + `PersistGate` (children render only after rehydration) + MUI theme. Initial theme colour comes from sessionStorage `helloConfig.primary_color`, else `#333333`.
8. **Tab session + redirect** — `app/chatbot/page.tsx:InterfaceEmbed`
   Reads or creates sessionStorage `tab_session_id` (`Date.now()`), dispatches `setDataInDraftReducer({ tabSessionId })`, then `router.replace('/chatbot/hello')`, keeping `?env=stage` if present. `interfaceDetails` is ignored. Why it must go through `/chatbot`: [app-shell](../modules/app-shell.md#which-page-the-iframe-loads).
9. **Wrapper mounts** — `app/chatbot/[chatbotId]/page.tsx` → `components/Chatbot-Wrapper/ChatbotWrapper.tsx`
   `addUrlDataHoc` injects `chatSessionId` (`draftData.chatSessionId`, still undefined) and composite `tabSessionId` = `${chatSessionId}_${tabSessionId}`. `ChatbotWithHooks` calls `useEmbeddingScriptEventHandler` (window `message` listener on a registry) and `useLocalStorageEventHandler`; it renders `null` until `chatSessionId` exists.
10. **`interfaceLoaded` posted** — `ChatbotWrapper` `useEffect` → `setTimeout(0)` → `window.parent.postMessage({ type: 'interfaceLoaded' }, '*')`
    Child effects (listener + `addEventHandler('helloData', …)` in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`) run before this parent effect, so the iframe is listening before the host is told to send.

### Handshake

11. **Host receives `interfaceLoaded`** — `handleIncomingMessages` (after the origin check in `setupMessageListeners` and the `event.source === own iframe` check) sets `state.interfaceLoaded` → `showIconIfReady`.
12. **Ready gate** — `public/chat-widget.js:showIconIfReady`
    Runs its body only when `interfaceLoaded && delayElapsed`, so it is reached from whichever of steps 6 and 11 happens last (and again on every later `initChatWidget`). Then:
    - launcher shown now only if `helloProps.hide_launcher` is explicitly `false`/`'false'`, `hideHelloIcon` is falsy and not `isMobileSDK`; otherwise it waits for `hide_widget` (step 17).
    - `helloLaunchWidget` → `openChatbot`.
    - `icon_position` left/right → `left_all_child`/`right_all_child`; `icon_bottom_margin` → `bottom` on launcher, its children and the container.
    - `sendInitialData`: posts `helloData` with `helloProps`; also `CHATBOT_OPEN` if the container is already visible. If `helloProps` is null (host never called `initChatWidget`) nothing is sent and the iframe stays blank.
13. **Iframe handles `helloData`** — `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:handleHelloData`
    - `fullWidgetToken` = `${widgetToken}_${unique_id}` if `unique_id`, else `widgetToken`; written to sessionStorage `widgetToken` (this becomes the prefix for every `utils/utilities.js:setLocalStorage` key).
    - removes legacy `is_anon`; applies `sdkConfig.customTheme` and `theme`/`sdkConfig.theme` (`light`/`dark`/`system`); `variables` → `setVariablesForHelloBot`.
    - Branch, token changed vs previous sessionStorage value: reset appInfo thread keys, load notifications from `<fullWidgetToken>_persist:Chat`, and reset again after `chatSessionId` changes (anon → known → anon reuses keys).
    - writes `userData` (`user_jwt_token` only when `unique_id`/`mail`/`number` present) and `WidgetId` to localStorage; dispatches `chatSessionId` + `widgetToken` to draftData; sessionStorage `helloConfig` = full payload; `setHelloConfig`; `mail && number && name` → `showWidgetForm: false`.
    Identity rules (known vs anonymous, merge on login/logout): [hello-api](../integrations/hello-api.md#identity-model).
14. **Chatbot mounts** — `ChatbotWithHooks` now renders `components/Chatbot/Chatbot.tsx` (HOC-wrapped). Its hooks start: `useHelloEffects`, `useReduxEffects`, `useReduxStateManagement`.

### Init sequence (`useHelloEffects`)

15. **Sockets wired early** — `hooks/socket.js:useSocket`, `hooks/notifications/notificationSocket.ts`
    Both read `Hello[chatSessionId].socketJwt.jwt`. The `Hello` slice is persisted in localStorage, so on a returning visit the JWT, channel list and `widgetInfo` are already there and the chat socket connects now, against `getSocketUrl()` (env default; region not resolved yet). First visit: no JWT, nothing happens until step 20.
16. **`initializeHelloServices(widgetToken)`** — `components/Chatbot/hooks/useHelloEffects.ts`, effect on `draftData.chatSessionId`
    `widgetToken = chatSessionId.split('_')[0]`; returns unless it equals localStorage `WidgetId` (dedupe guard). Reads `a_clientId`, `k_clientId`, `userData`. `needsAnonymousRegistration` = no client ids and no `unique_id`/`mail`/`number`.
    1. **Region** — `config/helloApi.ts:getRoutingRegion` → `POST /routing-region/` (auth: bare `WidgetId`). `config/regionConfig.ts:setRegionUrls(region_url, socket_url)`; if either changed → `socketManager.reconnect()` (no-op when no socket exists; otherwise rebuilds against the region URL keeping channels). Failure: logged, env defaults stay. Stage: `DEFAULT_HELLO_HOST_URL`/`DEFAULT_SOCKET_URL` switch to the stage hosts when the iframe URL has `env=stage`. See [region routing](../integrations/hello-api.md#region-routing).
    2. **Widget info** — `initializeHelloChat` → `POST /widget-info/` (auth: `WidgetId`). Then, in order: null → `initializeHelloChat_failed` to parent; always `hide_widget` with `widgetData?.hide_launcher`; always `setDataInLocal` `widgetInfo`; truthy `launch_widget` → `launch_widget`. `setWidgetInfo`; theme from `primary_color` unless `sdkConfig.customTheme` (also written back into sessionStorage `helloConfig`); `teams.length <= 1` → `currentTeamId`.
    3. **Client** — anonymous → `registerAnonymousUser` (`POST /anonymous-client-details/`, stores `a_clientId`); else `useFetchChannels` → `getAllChannels` (`POST /pubnub-channels/list/`) → `setChannelListData`, form visibility, `setHelloClientInfo`, stores `k_clientId`/`a_clientId`.
    4. `emitEventToParent('uuid', { uuid: k_clientId || a_clientId })` → host `setUUID` → co-browse device id (or mobile SDK).
    5. **JWT** — only if `widgetData` and a client id: `getJwtToken` → `setJwtToken`.
    6. **Greeting** — only `bot_type` `lex`/`chatgpt` with `company_id` + `bot_id`: `getGreetingQuestions` → `setGreeting`; text/options and no real chats → `SHOW_STARTER_QUESTION`.
    7. `getAgentTeamApi` → `setAgentTeams` (not awaited).
    8. `voice_call_widget` → `getClientToken` → `helloVoiceService.initialize()`; a stored `callToken` → `OPEN_CHATBOT` + `rejoinCall`. See [voice calling](../modules/voice-calling.md).
    9. After an anonymous registration: `fetchChannels()` now (not awaited).
    10. sessionStorage `helloConfig` with more than one key → strip the `keysToRemove` list, map `name`/`number`/`mail` → `Name`/`Phonenumber`/`Email`, `saveClientDetails` if anything is left.
    11. `emitEventToParent('ENABLE_DOMAIN_TRACKING')` → host `enableDomainTracking` posts `parent-route-changed { websiteUrl }` now and on every `pushState`/`replaceState`/`popstate` → `addDomainToHello` (`PUT /add-domain/`).
17. **Host reacts to init messages** — `handleIncomingMessages`
    - `hide_widget`: ignored if the host passed a `hide_launcher` key or `isMobileSDK`; `true` → `hideChatbotWithIcon`; otherwise (including `undefined`) → `showChatbotIcon` unless `helloLaunchWidget`.
    - `launch_widget`: ignored if the host passed a `launch_widget` key or `isMobileSDK`; `true` → `openChatbot`.
    - `setDataInLocal`: host `localStorage.setItem(key, payload)` (`widgetInfo`, and from `setLocalStorage` of client ids: `hello-widget-uuid`, `hello-widget-anonymoud-uuid`).
    - `SHOW_STARTER_QUESTION` → `createAndShowStarterQuestion`; `SET_BADGE_COUNT` → `updateBadgeCount`.
18. **Sockets connect and subscribe** — `useSocket` effect re-runs on the new JWT / `channelListData` / `event_channels` / `company_id`: `socketManager.connect(jwt)` then `subscribe([ch-comp-<company_id>-<clientId>, ...channels[].channel, ...event_channels])`; subscriptions queue until `connect` fires. Notification socket subscribes `ch-comp-<company_id>.<clientId>` (and FCM for the mobile SDK). Channel names and reconnect rules: [realtime](../modules/realtime.md#channels).

### First render and idle

19. **History** — `useHelloEffects` effect on `currentChannelId`: fetches only when a channel is already selected and not `demo_widget`. `appInfo` is persisted in sessionStorage, so a reload in the same tab with the same token restores `currentChannelId` and calls `useFetchHelloPreviousHistory` → `getHelloChatHistoryApi` (`POST /get-history/`, needs `channelListData.uuid`). A fresh tab has no channel selected and fetches no history at boot.
20. **First render** — `components/Chatbot/Chatbot.tsx`
    Drawer: `useReduxEffects` sets `toggleDrawer = !isSmallScreen`; mount with no `currentChatId` opens it; `isDefaultNavigateToChatScreen` (≤1 team, ≤1 channel, no channel id) closes it and focuses the input. Body: `NotificationPage` if viewing notifications, else `EmptyChatView` (no `subThreadId` and empty greeting; seeds `prefillInputMessage` from `helloConfig.prefillMessage`), else `ActiveChatView`. `show_widget_form` (script config, then `widgetInfo`, then the list-response heuristic) shows `FormComponent`.
21. **Badge** — `useHelloEffects` posts `SET_BADGE_COUNT` (`sum(widget_unread_count)` + unread notifications, `99+` cap) whenever counts change, unless `demo_widget`.
22. **Idle** — iframe container still `display:none` until a launcher click, `launch_widget`, or a host `open()` (`openChatbot` posts `open` and `CHATBOT_OPEN` → `appInfo.isChatbotOpen`). Sockets are connected; nothing else runs until user input, a socket event or a host API call.

## Data at key hops

`helloData` (host → iframe, the merged `helloProps`). Keys read by the iframe at boot; anything else is forwarded to `saveClientDetails` in step 16.10.
```json
{
  "widgetToken": "required",
  "unique_id": "optional: makes the user known, namespaces storage",
  "name": "", "mail": "", "number": "",
  "user_jwt_token": "kept only with an identity",
  "sdkConfig": { "customTheme": "#hex", "theme": "light|dark|system" },
  "theme": "light|dark|system",
  "variables": {},
  "hide_launcher": false, "launch_widget": false, "parentId": "", "isMobileSDK": false,
  "icon_position": "left|right", "icon_bottom_margin": 0, "previewLinks": [],
  "show_widget_form": true, "prefillMessage": "", "pushConfig": {},
  "flow_origin": "", "integration": ""
}
```

`POST /routing-region/` response (`response.data`):
```json
{ "region_url": "https://…", "socket_url": "https://…" }
```

`POST /widget-info/` response (`response.data`, stored as `Hello[chatSessionId].widgetInfo`). Fields read during boot:
```json
{
  "hide_launcher": false, "launch_widget": false, "primary_color": "#…",
  "company_id": 0, "bot_id": "", "bot_type": "lex|chatgpt|…",
  "voice_call_widget": false, "demo_widget": false, "show_widget_form": true,
  "teams": [{ "id": "" }], "event_channels": ["…typing…"]
}
```

`POST /pubnub-channels/list/` response (`response.data`, stored as `channelListData`):
```json
{
  "uuid": "client id", "unique_id": "", "presence_channel": "",
  "customer_name": "", "pseudo_name": true, "customer_mail": "", "customer_number": "",
  "channels": [{ "id": 0, "channel": "", "team_id": "", "widget_unread_count": 0, "is_closed": false, "assigned_type": "" }]
}
```

Other boot responses: `/anonymous-client-details/` → `data.data.uuid` (→ `a_clientId`); `/jwt-token/` → `data.data.jwt_token`; `/web-rtc/get-client-token/` → `data.data.jwt_token`.

## Errors

- Every `config/helloApi.ts` call used here catches its own error, shows `errorToast` and returns `null`/`[]` (except `getRoutingRegion`, which only logs). `initializeHelloServices` therefore never sees a throw from them; its outer `try` only logs.
- Missing script `src` → console error, nothing created. Errors in `loadChatbotEmbed` are logged.
- Iframe never sends `interfaceLoaded` (route crash, blocked load) → `showIconIfReady` never passes its gate, `helloData` is never sent and the launcher stays hidden. `app/error.tsx` posts `CLOSE_CHATBOT`.

> [!WARNING]
> widget-info failure: the iframe posts `initializeHelloChat_failed` and its code carries on (registration/list still run; JWT, greeting and calling are skipped because they check `widgetData`). But the host handles that message with `block_chatbot = true` + `cleanupChatbot()`, which removes the iframe container, launcher, stylesheet and starter question. The iframe is destroyed, so in a browser embed the "continues" part is cut short, and every later `initChatWidget` call returns early until the page reloads. The `catch` with "return early" around `initializeHelloChat` is unreachable for HTTP errors.

> [!WARNING]
> The `Hello` slice (JWT, channel list, widgetInfo) rehydrates from localStorage before init, so `useSocket` connects with the previous visit's JWT to the default socket URL before routing-region resolves. `getRoutingRegion` then calls `socketManager.reconnect()`, which reuses that stored JWT; the fresh JWT from step 16.5 is ignored by `connect` while a socket to the same URL is connected or connecting. See [realtime](../modules/realtime.md#gotchas).

> [!WARNING]
> `SET_VARIABLES_FOR_BOT` from `initChatWidget` is posted immediately, usually before the iframe has registered its handler, so it is dropped. Boot relies on `helloData.variables` instead.

## Side effects

| Where | Write | By |
|---|---|---|
| Host DOM | launcher, `<link>` stylesheet, iframe container (hidden) | `loadContent` |
| Host `localStorage` | `widgetInfo`, `hello-widget-uuid`, `hello-widget-anonymoud-uuid` (via `setDataInLocal`) | `useHelloEffects`, `utils/utilities.js:setLocalStorage` |
| Host `history` | `pushState`/`replaceState` wrapped | `enableDomainTracking` |
| Iframe sessionStorage | `tab_session_id`, `widgetToken`, `helloConfig` (+ `primary_color`) | `InterfaceEmbed`, `handleHelloData`, `useHelloEffects` |
| Iframe localStorage (prefixed `<widgetToken>_`) | `userData`, `WidgetId`, `a_clientId`, `k_clientId`, `JwtTokenForSocket`, `HelloClientToken`, `client` | `handleHelloData`, `config/helloApi.ts` |
| Iframe localStorage (raw) | `<WidgetId>_last_unique_id`, `<WidgetId>_k_clientId`, `<WidgetId>_a_clientId` | `getAllChannels` |
| Redux `draftData` | `tabSessionId`, `chatSessionId`, `widgetToken` | `InterfaceEmbed`, `handleHelloData` |
| Redux `Hello[chatSessionId]` | `helloConfig`, `widgetInfo`, `channelListData`, `socketJwt`, `greeting`, `agent_teams`, `clientInfo`, `showWidgetForm` | `handleHelloData`, `useHelloEffects`, `useFetchChannels` |
| Redux `appInfo[tabSessionId]` | thread ids reset, `currentTeamId` | `handleHelloData`, `useHelloEffects` |
| Redux `Chat` | `notifications`, drawer toggle | `handleHelloData`, `Chatbot`, `useReduxEffects` |
| In memory | region URLs; socket channels | `config/regionConfig.ts`, `hooks/socketManager.js` |

Iframe → host messages during boot: `interfaceLoaded`, `initializeHelloChat_failed`, `hide_widget`, `setDataInLocal`, `launch_widget`, `uuid`, `SHOW_STARTER_QUESTION`, `SET_BADGE_COUNT`, `ENABLE_DOMAIN_TRACKING`, `OPEN_CHATBOT` (call rejoin). Host → iframe: `helloData`, `CHATBOT_OPEN`, `SET_VARIABLES_FOR_BOT`, `parent-route-changed`. All use `postMessage(..., '*')`; the iframe does not check `event.origin`.

## Changing this safely

- Adding an init step: put it after `getRoutingRegion` in `initializeHelloServices`; any Hello call before it hits the env default host, not the widget's region (a3cbac3).
- Do not move the `interfaceLoaded` post into a child or earlier effect; the `helloData` listener must already be registered.
- A new boot-time host message needs a case in `handleIncomingMessages` in all three `public/chat-widget*.js` copies; see [embed-script](../modules/embed-script.md#prod-dev-and-local-copies).
- Test both identities: no `unique_id` (anonymous path, step 16.3 first branch) and with `unique_id` (list path), plus a reload in the same tab (persisted `appInfo` → history fetch) and a new tab.

> [!TODO] Needs a human: should a widget-info failure tear the widget down (current host behaviour) or keep the iframe and let init continue (current iframe behaviour)? The two sides disagree.
