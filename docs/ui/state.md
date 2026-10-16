---
covers: ["store/**", "types/reduxCore.ts", "types/appInfo/**", "utils/storageUtility.ts", "utils/ChatbotUtility.ts", "utils/deepCheckSelector.ts", "hoc/addUrlDataHoc.tsx", "components/Chatbot/hooks/useTabData.ts", "components/AppWrapper.tsx", "components/context.tsx", "components/Chatbot-Wrapper/ChatbotWrapper.tsx", "components/Interface-Chatbot/InterfaceChatbot.tsx", "components/Interface-Chatbot/contexts/ReplyContext.tsx", "components/Chatbot/hooks/HelloVoiceService.ts"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# State

The widget keeps state in five places: a Redux Toolkit store (persisted with redux-persist, synced across tabs with redux-state-sync, plus one saga), a handful of React contexts, one call-state singleton, module-level variables, and raw `sessionStorage`/`localStorage` keys. Store wiring (middleware order, SSR split, `urlData`) is explained in [app-shell](../modules/app-shell.md#store); this page is the map of what lives where.

## Server state

There is no React Query/SWR cache. API clients are plain axios functions in `config/api.ts` (GTWY), `config/helloApi.ts` (Hello) and `config/ragApi.ts` (RAG). They are called from hooks in `components/Chatbot/hooks/` (`useChatActions.ts`, `useHelloIntegration.ts`, `useHelloEffects.ts`, `useChatEffects.ts`) and from one saga, then the hook dispatches the result into a slice. Realtime data (rtlayer for GTWY, socket.io for Hello) also lands in the slices. Endpoint lists: [api](../api.md); flows: [ai-chat](../modules/ai-chat.md), [hello](../integrations/hello.md).

Saga: `store/rootSaga.ts` forks `store/interface/interfaceSaga.ts` (empty) and `store/hello/helloSaga.ts`, which runs `takeLatest("Hello/getHelloDetailsStart", getHelloDetailsSaga)`. Despite the name, `store/hello/helloGeneratorFunctions.ts:getHelloDetailsSaga` calls the GTWY bridge subscribe API and writes `HelloAgentAuth` to localStorage. Nothing else uses sagas; new async work goes in hooks.

## Client state

### Redux slices (`store/combineReducer.js`)

| Slice | Files | Keyed by | Key fields | Persisted | Cross-tab sync |
|---|---|---|---|---|---|
| `Interface` | `store/interface/` | `chatSessionId` | `interfaceContext[bridgeName]` (`variables`, `threadList[threadId]`), `chatTitle`, `chatSubTitle`, `chatIcon`, `allowModalSwitch`, `allowBridgeSwitch`, `modalConfig`, `selectedAiServiceAndModal`, `headerButtons`, `eventsSubscribedByParent` | localStorage `persist:root` (root config) | yes |
| `Hello` | `store/hello/` | `chatSessionId` (widget token) | `widgetInfo`, `helloConfig`, `channelListData`, `socketJwt`, `greeting`, `agent_teams`, `clientInfo`, `mode` | localStorage `persist:root` | yes, except `Hello/setUnReadCount` without `resetCount` |
| `Chat` | `store/chat/chatSlice.ts`, `store/chat/chatReducerV2.ts` | flat; message maps keyed by `subThreadId` | `messageIds`, `msgIdAndDataMap`, `loading`, `chatsLoading`, `isTyping`, `options`, `images`, `starterQuestions`, `isToggledrawer`, `hasMoreMessages`, `notifications`, mirrors `threadId`/`subThreadId`/`bridgeName` | only `notifications`, key `persist:Chat` in widget-scoped localStorage (`<widgetToken>_persist:Chat`) | no |
| `draftData` | `store/draftData/draftDataSlice.ts` | flat | `chatSessionId`, `tabSessionId`, `widgetToken`, `chatbotId`, `isHelloUser`, `hello.variables`, `isChatbotMinimized`, `prefillInputMessage` | no | no |
| `appInfo` | `store/appInfo/` | `` `${chatSessionId}_${tabSessionId}` `` | `threadId`, `subThreadId`, `bridgeName`, `versionId`, `userId`, `config`, `currentChannelId`, `currentChatId`, `currentTeamId`, `showNotificationView`, `callToken`, `hideCloseButton`, `hideFullScreenButton` | sessionStorage `persist:appInfo` | no |

Full shapes: `Interface` in [interface-renderer](../modules/interface-renderer.md), `Hello` in [hello](../integrations/hello.md#redux-shape), `Chat` in [ai-chat](../modules/ai-chat.md), `appInfo` entry in [app-shell](../modules/app-shell.md#session-keys-chatsessionid-tabsessionid-urldata). Types: `types/reduxCore.ts` (`$ReduxCoreType` has no `Chat` key), `types/appInfo/appInfoReduxType.ts`, `types/hello/HelloReduxType.ts`, `types/interface/InterfaceReduxType.ts`.

Persistence configs (all `version: 1`, no `migrate`):

```js
root    { key: "root",    storage: STORAGE_OPTIONS.local,            blacklist: ["appInfo", "draftData", "Chat"] }
appInfo { key: "appInfo", storage: STORAGE_OPTIONS.session }
Chat    { key: "Chat",    storage: createWidgetScopedLocalStorage(), whitelist: ["notifications"] }
```

`crossTabSyncConfig` (`store/index.js`) broadcasts on BroadcastChannel `crossTabChannel` and drops: redux-persist actions, every action whose type prefix (before the first `/`) is `appInfo`, `draftData` or `Chat`, and unread-count increments.

### Tab scoping

`store/index.js:customMiddleware` stamps every action with `action.urlData = { chatSessionId, tabSessionId: "<chatSessionId>_<tab>", ...appInfo[thatKey] }`. Reducers index `Interface`/`Hello` by `urlData.chatSessionId` and `appInfo` by `urlData.tabSessionId`; they never take these ids in the payload. Actions replayed from another tab keep the sender's `urlData`. Components get the same ids as props from `hoc/addUrlDataHoc.tsx`, which reads `appInfo[tabSessionId]` fields through `components/Chatbot/hooks/useTabData.ts`. Details: [app-shell](../modules/app-shell.md#session-keys-chatsessionid-tabsessionid-urldata).

### Reading state

Use `utils/deepCheckSelector.ts:useCustomSelector` (deep-equal comparator), not `useSelector` and not the unused `store/useTypedHooks.ts:useAppSelector`. Select by key with optional chaining: `state.Hello?.[chatSessionId]?.widgetInfo`, `state.appInfo?.[tabSessionId]?.subThreadId`.

### React contexts

| Context | Defined in | Provided by | Holds | Read by |
|---|---|---|---|---|
| `ThemeContext` | `components/AppWrapper.tsx` | `AppWrapper` (every route) | `themeColor`, `themeMode`, `handleThemeChange`, `handleModeChange` | chatbot layout, Hello handlers, `/chatbotpreview`. See [design-system](design-system.md). |
| `ChatbotContext` | `components/context.tsx` | `app/chatbot/layout.tsx` | `chatbotConfig`, `chatbot_id`, `userId`, `token`, `themeColor`, `onConfigChange`, `toggleHideCloseButton`, `isHelloUser`, `environment` | `app/chatbot/page.tsx`, `ChatbotHeader`, `useRtlayerEventManager` |
| `ChatContext` | `components/Chatbot-Wrapper/ChatbotWrapper.tsx` | `ChatbotWrapper` | `chatSessionId`, `tabSessionId` | `useChatActions.ts`, `useHelloIntegration.ts` |
| `MessageContext` | `components/Interface-Chatbot/InterfaceChatbot.tsx` | `components/Chatbot/Chatbot.tsx` | `messageRef` (the input element), `timeoutIdRef` | text field, drawer, action hooks (focus or read the input) |
| `ReplyContext` | `components/Interface-Chatbot/contexts/ReplyContext.tsx` | `ReplyProvider` inside `ChatbotWrapper` | `replyToMessage`, `setReplyToMessage`, `clearReply` | text field, message cards, Hello hooks. `useReplyContext()` throws outside the provider. |
| `GridContext` | `components/Grid/Grid.tsx` | `Grid` | the JSON UI reply being rendered | `ComponentRenderer`, `InterfaceTextfield` |

### Outside React and Redux

- **Call state:** `components/Chatbot/hooks/HelloVoiceService.ts` exports `helloVoiceService = HelloVoiceService.getInstance()`. It owns the WebRTC client, `callState` (`idle` / `ringing` / `connected` / `rejoined`), direction, call id, mute and media stream, and emits `callStateChanged`. `components/Chatbot/hooks/useCallUI.ts` subscribes and mirrors the connected call id into `appInfo.callToken` so a reload can rejoin. See [hello](../integrations/hello.md#voice-calling-msg91-webrtc-call).
- **Module variables:** region URLs in `config/regionConfig.ts`, the pre-subscribed channel set in `utils/preSubscribedChannels.ts`, the socket singletons in `hooks/socketManager.js` and `hooks/notifications/notificationSocketManager.ts`.

### Storage keys outside Redux

sessionStorage (per iframe tab), written with `utils/ChatbotUtility.ts:SetSessionStorage`, read with `GetSessionStorageData`:

| Key | Written by | Read by |
|---|---|---|
| `tab_session_id` | `app/chatbot/page.tsx` | same, then copied to `draftData.tabSessionId` |
| `interfaceToken`, `interfaceUserId` | `app/chatbot/page.tsx` (GTWY) | `utils/interceptor.ts` sends `interfaceToken` as `Authorization` |
| `ragToken` | `app/rag/page.tsx` | `utils/interceptor.ts` sends it as `proxy_auth_token` when the URL contains `rag` |
| `widgetToken` | Hello embedding-script handler | storage prefixing (`utils/utilities.js`, `utils/storageUtility.ts`) |
| `helloConfig` | Hello embedding-script handler, `useHelloEffects.ts` | `AppWrapper` (initial `primary_color`), `FormComponent`, `config/helloApi.ts` |

localStorage:

- **Widget-scoped keys** via `utils/utilities.js:setLocalStorage` / `getLocalStorage` / `removeFromLocalStorage`, stored as `<widgetToken>_<key>`: `WidgetId`, `k_clientId`, `a_clientId`, `userData`, `client`, `JwtTokenForSocket`, `HelloClientToken`, `HelloCallToken`, `HelloAgentAuth`. (`is_anon` is only removed now; its writers are commented out, commit e008ba8.) Writing `WidgetId`/`k_clientId`/`a_clientId` also fires a `localstorage-updated` window event and (for the client ids) posts `setDataInLocal` to the host. Raw `${widgetId}_…` keys for logout/last-login live in `config/helloApi.ts`; see [hello](../integrations/hello.md#identity-model).
- **`__session_backup_widgetToken`** (key built by `localBackupKey` in `utils/ChatbotUtility.ts`): copy of the sessionStorage `widgetToken`, restored by `GetSessionStorageData` when sessionStorage was wiped (iOS in-app browsers). See [app-shell](../modules/app-shell.md#storage-and-storage-blocked). <!-- verify:ignore -->
- **`hello_link_preview:<url>`**: link-preview cache in `components/Hello/AppleInteractiveMessage.tsx`.
- **`persist:root`**, **`<widgetToken>_persist:Chat`**: redux-persist (above).

## Rules

- **Which state goes where:**
  - Shared by every tab of one widget (config, channels, thread lists) → `Interface` or `Hello`, keyed by `chatSessionId`.
  - Different per tab (current thread/channel/team, open views, call token) → `appInfo` via `setDataInAppInfoReducer`.
  - Per page load, not worth restoring (session ids, `isHelloUser`, minimized, prefill) → `draftData`.
  - Messages and chat UI flags → `Chat`. It is per tab and not persisted except `notifications`.
  - Lives only under one subtree (reply target, input ref) → a React context.
  - Imperative objects (WebRTC call, sockets) → a module singleton, with the bit that must survive reload mirrored into `appInfo`.
  - Credentials and boot data the host gives once → sessionStorage via `SetSessionStorage`. Identity that must survive the tab → widget-scoped localStorage via `setLocalStorage`.
- Write the current thread to `appInfo[tabSessionId].subThreadId`. `components/Chatbot/hooks/useReduxEffects.ts` copies it to `Chat.subThreadId`; never set the `Chat` copy directly.
- A new slice is persisted to `persist:root` and broadcast to other tabs by default. Add it to the root `blacklist` and to `crossTabSyncConfig.predicate` unless both are intended.
- Never call `localStorage.setItem` for widget data directly; the `<widgetToken>_` prefix is what keeps two widgets on one origin apart.

> [!WARNING]
> `createWidgetScopedLocalStorage().setItem` silently skips the write when sessionStorage has no `widgetToken`. GTWY sessions never set one, so `Chat.notifications` is not persisted for GTWY.

> [!WARNING]
> `Interface` and `Hello` persist under the unprefixed `persist:root`, shared by every widget token on the origin. Changing a persisted shape needs a `version` bump plus `migrate`; none exists today.

> [!WARNING]
> Any action dispatched before `draftData.chatSessionId` and `draftData.tabSessionId` are set gets a `urlData.tabSessionId` like `_<tab>` or `<id>_` (both ids start as empty strings). `appInfo` writes land under a key nobody reads, and `Interface`/`Hello` reducers return early. Nothing throws.

> [!WARNING]
> `utils/interceptor.ts` runs `localStorage.clear()` on any 401, which wipes `persist:root` and every widget's keys on the origin, not just the current widget's.
