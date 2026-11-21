---
covers: ["store/**", "types/**", "utils/safeStorage.ts", "utils/storageUtility.ts", "utils/deepCheckSelector.ts", "utils/ChatbotUtility.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# State

The widget iframe keeps all client state in one Redux Toolkit store (`store/index.js:store`), wrapped by redux-persist and redux-state-sync. It has no database: browser `localStorage` / `sessionStorage` are the only durable data, and this doc is the home for every storage key the iframe uses. Each widget iframe is its own document, so it has its own store instance; the per-widget keying described below exists because several iframes (other tabs, other widgets) share the same storage origin and the same BroadcastChannel.

## Files

| File | Role |
|---|---|
| `store/index.js` | Builds the store: `customMiddleware` (stamps `action.urlData`), root persist config, cross-tab sync config. Exports `store`, `persistor`, `initializeStore`, `getInfoParametersFromUrl`. |
| `store/combineReducer.js` | `rootReducer`: four slices, plus nested persist configs for `Chat` and `appInfo`. |
| `store/hello/helloSlice.ts`, `store/hello/helloReducer.ts` | `Hello` slice: Hello widget config, channel list, socket JWT, client info. Keyed by `chatSessionId`. |
| `store/appInfo/appInfoSlice.ts`, `store/appInfo/appInfoReducer.ts` | `appInfo` slice: which thread/channel this tab has open. Keyed by tab session key. |
| `store/chat/chatSlice.ts`, `store/chat/chatReducerV2.ts` | `Chat` slice: messages per thread, loading/UI flags, push notifications. Not keyed by widget. |
| `store/draftData/draftDataSlice.ts` | `draftData` slice: session ids for this iframe, Hello bot variables, minimize flag, prefill text. Never persisted. |
| `store/useTypedHooks.ts` | `useAppSelector` / `useAppDispatch` typed hooks (used in 3 files only). |
| `utils/deepCheckSelector.ts` | `useCustomSelector`: `useSelector` with a deep-equality compare. The selector hook used almost everywhere. |
| `types/reduxCore.ts`, `types/hello/HelloReduxType.ts`, `types/appInfo/appInfoReduxType.ts`, `types/utility.ts` | State and action types. |
| `utils/safeStorage.ts` | `safeLocalStorage` / `safeSessionStorage`: Web Storage with an in-memory mirror that never throws. |
| `utils/storageUtility.ts` | redux-persist storage adapters: `STORAGE_OPTIONS`, `createWidgetScopedLocalStorage`, `createNoopStorage`. |
| `utils/ChatbotUtility.ts` | `SetSessionStorage` / `GetSessionStorageData`, with a localStorage backup for `widgetToken`. |

The prefixed `localStorage` helpers `setLocalStorage`, `getLocalStorage`, `removeFromLocalStorage` live in `utils/utilities.js` (app-shell area) but are described here because they define the key scheme.

## Server state

There is no fetching library (no RTK Query / React Query). Hello REST calls are plain axios functions in `config/helloApi.ts`; hooks call them and dispatch the result into the store (`setChannelListData`, `setInitialMessages`, `setJwtToken`, …). See [hello-api](../integrations/hello-api.md). Socket events arrive through `hooks/socketEventHandler.ts` and are dispatched the same way; see [realtime](../modules/realtime.md). There is no cache invalidation: the store holds the last value written, and the next API call or socket event overwrites it.

## Client state

### Session ids and the `urlData` stamp

Every action passes through `store/index.js:customMiddleware`, which sets `action.urlData` from `store/index.js:getInfoParametersFromUrl` unless the action already carries one:

```ts
action.urlData = {
  chatSessionId,                                  // state.draftData.chatSessionId
  tabSessionId: `${chatSessionId}_${tabSessionId}`, // NOT draftData.tabSessionId as-is
  ...state.appInfo[`${chatSessionId}_${tabSessionId}`] // subThreadId, currentChannelId, …
}
```

The `Hello` and `appInfo` reducers read their key from `action.urlData`, never from the payload. Components never pass ids in the payload for these slices.

- `chatSessionId` = the "full widget token": `${widgetToken}_${unique_id}` when the host page passes a `unique_id`, else `widgetToken`. Set by `handleHelloData` in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` (dispatches `setDataInDraftReducer({ chatSessionId, widgetToken })`).
- `draftData.tabSessionId` = `Date.now()` string created once per tab in `app/chatbot/page.tsx` and kept in sessionStorage `tab_session_id`.
- The appInfo key is `${chatSessionId}_${tabSessionId}`. `hoc/addUrlDataHoc.tsx:addUrlDataHoc` builds the same string and injects `chatSessionId` / `tabSessionId` props.

Cross-tab synced actions arrive with the sender's `urlData` already set, so `customMiddleware` leaves it alone and the receiving tab writes into the same `chatSessionId` key.

### Slice shapes

`Hello` (`types/hello/HelloReduxType.ts:$HelloReduxType`), keyed by `chatSessionId`:

```ts
{
  [chatSessionId: string]: {
    helloConfig?: HelloData;          // setHelloConfig: the helloData object sent by the embed script (widgetToken, unique_id, name, mail, number, sdkConfig, viewMode, …)
    widgetInfo: any;                  // setWidgetInfo (merged)
    channelListData: ChannelListData; // setChannelListData: channels sorted open-first; also sets Channel = channels[0]
    Channel?: any;                    // setChannel
    socketJwt: { jwt: string };       // setJwtToken
    greeting?: object;                // setGreeting
    showWidgetForm?: boolean | null;  // setHelloKeysData
    agent_teams?: { teams?: Record<id, name>, agents?: Record<id, name> }; // setAgentTeams (arrays → id→name maps)
    clientInfo: any;                  // setHelloClientInfo (merged)
    // also written by setHelloKeysData but not in the type: k_clientId, a_clientId (mirrored from localStorage), any other key
  }
}
```

Channel-level reducers mutate `channelListData.channels[]` in place: `setUnReadCount` (+1, or reset to 0 when `resetCount`), `moveChannelToTop`, `addChannel` (drops the `id === null` placeholder channel), `setChannelClosedStatus` (moves closed channels to the end), `setChannelBlockedStatus`, `changeChannelAssigned`. Channels are matched by `channel.channel` (the channel string id), not `channel.id`.

`appInfo` (`types/appInfo/appInfoReduxType.ts:$AppInfoReduxType`), keyed by `${chatSessionId}_${tabSessionId}`:

```ts
{ [tabKey: string]: {
    subThreadId: string; currentChannelId: string; currentChatId: string; currentTeamId: string;
    overrideChannelId?: string; isChatbotOpen: boolean; callToken: string;
    demoSessionId?: string; showNotificationView?: boolean;
} }
```

Only two actions: `setDataInAppInfoReducer` (shallow merge into the tab key) and `resetAppInfoReducer`. `components/Chatbot/hooks/useTabData.ts` is the usual reader.

`Chat` (`store/chat/chatReducerV2.ts:initialChatState`), one per iframe, threads keyed by `subThreadId` (= Hello channel id, or a temporary `notification-…` / generated id before the server assigns one):

```ts
{
  messageIds: Record<subThreadId, string[]>;                         // newest first
  msgIdAndDataMap: Record<subThreadId, Record<msgId, GenericMessage>>;
  rawHelloMsgList: Record<subThreadId, any[]>;                      // raw socket/local messages, newest first
  isTyping: Record<subThreadId, any>;
  loading, chatsLoading, openHelloForm, isToggledrawer, hasMoreMessages, newMessage: boolean;
  subThreadId: string; skip: number /* 1 */; images: any[];
  notifications: { id; content; timestamp; read }[];                 // campaign push messages
}
```

Messages are converted to the generic render format inside the reducer (`setInitialMessages`, `setPaginateMessages`, `setHelloEventMessage`, `updateHelloMessage` call `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx`); see [message-rendering](../modules/message-rendering.md). `moveThreadMessages({ from, to })` merges a temporary thread into the real channel once the server returns it (`components/Chatbot/hooks/useHelloIntegration.ts`).

`draftData` (`types/reduxCore.ts:$DraftDataReducerType`): `chatSessionId`, `tabSessionId`, `widgetToken`, `hello.variables` (merged by `setVariablesForHelloBot`), `isChatbotMinimized`, `prefillInputMessage`.

### Persistence (redux-persist)

| Persist key | Storage | What is saved | Config |
|---|---|---|---|
| `persist:root` | localStorage, no prefix (`STORAGE_OPTIONS.local`) | `Hello` only | `store/index.js:rootPersistConfig`, blacklist `appInfo`, `draftData`, `Chat` | <!-- verify:ignore -->
| `persist:appInfo` | sessionStorage, no prefix (`STORAGE_OPTIONS.session`) | whole `appInfo` | `store/combineReducer.js:appInfoPersistConfig` | <!-- verify:ignore -->
| `${widgetToken}_persist:Chat` | localStorage via `createWidgetScopedLocalStorage` | `Chat.notifications` only (whitelist) | `store/combineReducer.js:chatPersistConfig` | <!-- verify:ignore -->
| none | | `draftData` | rebuilt every load from `tab_session_id` and the embed script's helloData message |

All configs use `version: 1` with no `migrate`. `components/AppWrapper.tsx` renders `PersistGate loading={null}`, so nothing renders until rehydration ends. On the server (`typeof window === "undefined"`) every adapter is `createNoopStorage`.

Messages are deliberately not persisted (only notifications): each load refetches history from Hello.

### Cross-tab sync (redux-state-sync)

`store/index.js:crossTabSyncConfig` broadcasts on channel `crossTabChannel`. The predicate sends an action to other same-origin documents unless:

- it is a redux-persist action (`PERSIST`, `REHYDRATE`, `FLUSH`, `PAUSE`, `PURGE`, `REGISTER`), or
- its slice prefix (`actionTypeRoot`) is "appInfo", "draftData" or "Chat" (per-tab or per-iframe state), or
- it is `Hello/setUnReadCount` without `resetCount` (count increments).

So in practice only `Hello/*` actions sync, and unread resets sync but increments do not. Every tab has its own socket and dispatches its own increment from `hooks/socketEventHandler.ts`; a synced increment would count each message twice. Resets sync so reading a chat in one tab clears the badge everywhere.

The sync middleware and `initMessageListener` are added only when `window` exists (`store/index.js:initializeStore`). This is the "redux-sync-edge" hotfix (c593e56, Aug 2025, "fix redux-state-sync edge runtime error issue"); `app/chatbot/page.tsx` runs with `runtime = "edge"`. The same commit made `getInfoParametersFromUrl` read state from the middleware's `storeAPI` instead of the module-level `store` export, which does not exist yet while `configureStore` is still running. Keep both: no browser-only code at store creation on the server, and no reference to the exported `store` inside middleware.

### Storage keys (the data model)

`setLocalStorage(key)` / `getLocalStorage(key)` / `removeFromLocalStorage(key)` in `utils/utilities.js` write `${widgetToken}_${key}` where `widgetToken` = sessionStorage `widgetToken` (the full widget token), or the bare key when it is not set yet. This prefix is what lets several widgets / users on one origin keep separate client ids ("multi widget handling", 00039fe; "multi widget local storage clear issue", cc4ba5f).

| Key | Storage | Prefixed | Written by | Meaning |
|---|---|---|---|---|
| `widgetToken` | session (+ backup) | no | `handleHelloData` | Full widget token; the prefix for every scoped localStorage key |
| `__session_backup_widgetToken` | local | no | `utils/ChatbotUtility.ts:SetSessionStorage` | Backup restored when sessionStorage is wiped | <!-- verify:ignore -->
| `tab_session_id` | session | no | `app/chatbot/page.tsx` | Per-tab id for the appInfo key |
| `helloConfig` | session | no | `handleHelloData`, `useHelloEffects` | Raw helloData JSON; read for theme colour before Redux rehydrates |
| `WidgetId` | local | yes | `handleHelloData`, `utils/helloInterceptor.ts` | Bare widget token (no `unique_id`) used as Hello `authorization` |
| `k_clientId` / `a_clientId` | local | yes | `config/helloApi.ts`, `hooks/socketEventHandler.ts` | Known / anonymous Hello client uuid; also posted to the host page as `hello-widget-uuid` / `hello-widget-anonymoud-uuid` (`setDataInLocal`) and mirrored into `Hello` via the `localstorage-updated` event |
| `userData`, `client` | local | yes | `handleHelloData`, `config/helloApi.ts` | Identity sent as `user_data`; customer details returned by Hello |
| `JwtTokenForSocket`, `HelloClientToken`, `HelloCallToken` | local | yes | `config/helloApi.ts` | Socket / client / call JWTs |
| `is_anon` | local | yes | removed in `handleHelloData` | Legacy; only removed now |
| `${WidgetId}_last_unique_id`, `${WidgetId}_k_clientId`, `${WidgetId}_a_clientId`, `${WidgetId}_${unique_id}_k_clientId` | local | manual, by `WidgetId` | `config/helloApi.ts`, cleared by `handleShutdownChatbot` | Login/logout merge bookkeeping (which anon uuid to send as `anon_client_uuid`) | <!-- verify:ignore -->
| `hello_link_preview:<url>` | local | no | `components/Hello/AppleInteractiveMessage.tsx` | Link preview cache | <!-- verify:ignore -->
| `mw_visitor` | local (raw, not safeStorage) | no | `utils/middlewareExperiments.ts` | A/B experiment visitor id |

The `Hello` login/merge logic that reads these keys is documented in [hello-api](../integrations/hello-api.md).

### Why `safeStorage` exists

In WhatsApp / Instagram in-app browsers on iOS (WKWebView with ITP), a cross-origin iframe's storage is blocked: `setItem` throws or is dropped and `getItem` returns null. The widget then sent `Authorization: null:null` and an empty `user_data` and got 401s (comment in `utils/safeStorage.ts`; fix 25f0b11 "use safeStorage for blocked WebView storage (iOS WhatsApp 401)", Oct 2026). `safeStorage` always tries real storage first, mirrors every write into an in-memory `Map`, and falls back to the map on throw or null. The first attempt (#472, Sep 2026) was reverted the same day (#474) and replaced by the `widgetToken` backup (#473, 69e0bc5); a short-lived `utils/appStorage.ts` layer (88fccef) was then removed when `safeStorage` came back in 25f0b11. <!-- verify:ignore -->

The `widgetToken` backup exists because those webviews can silently reload the iframe, which empties sessionStorage but keeps localStorage. Losing `widgetToken` changed the prefix, so `getLocalStorage` read the wrong keys and sent `null:null` (comment in `utils/ChatbotUtility.ts`). `GetSessionStorageData('widgetToken')` therefore falls back to `__session_backup_widgetToken` and copies it back into sessionStorage. <!-- verify:ignore -->

## Rules

- Read state with `useCustomSelector` (`utils/deepCheckSelector.ts`) and return an object literal from the selector. It compares with deep equality, so a new object each time does not re-render. Plain `useSelector` with an object literal re-renders on every store change.
- Index `Hello` with `chatSessionId` and `appInfo` with `` `${chatSessionId}_${tabSessionId}` `` (get both from `addUrlDataHoc` props or `state.draftData`). Never index `appInfo` with the bare `draftData.tabSessionId`.
- Never put the widget/tab id in a `Hello` or `appInfo` action payload; the reducers ignore it and use `action.urlData`.
- Use `setLocalStorage` / `getLocalStorage` (prefixed) or `safeLocalStorage` / `safeSessionStorage` for any new storage. Never call `window.localStorage` directly: it throws in blocked webviews.
- Persist new `Chat` fields only by adding them to `chatPersistConfig.whitelist`; anything there is written under the widget-scoped key.
- New per-tab or per-iframe slices must be added to both `rootPersistConfig.blacklist` and the `crossTabSyncConfig` predicate, or they will be persisted unscoped and broadcast to every tab.

> [!WARNING]
> Dispatching `setDataInAppInfoReducer` before `chatSessionId` and `tabSessionId` are set does not no-op: the key becomes the truthy string `"_"` (or `"<token>_"`), and the data lands under that key. `Hello` reducers, by contrast, silently drop actions while `chatSessionId` is `""`. Anything dispatched before the embed script's helloData message is lost.

> [!WARNING]
> `Hello/*` actions are broadcast to every same-origin widget document, including other widgets and other users on the same browser. They land under the sender's `chatSessionId` key, so they are harmless for rendering, but `persist:root` grows with every widget the browser has seen and is never pruned. <!-- verify:ignore -->

> [!WARNING]
> `setUnReadCount` calls `emitEventToParent('SET_BADGE_COUNT', …)` inside the reducer. A synced reset therefore also posts a badge update to the host page from every tab that receives it. Do not add more side effects to reducers; they run again on every synced copy.

> [!WARNING]
> `setUnReadCount`, `changeChannelAssigned` and `setChannelClosedStatus` default `channelId` to `state[chatSessionId].currentChannelId`, but `currentChannelId` lives in `appInfo`, not `Hello`, so the default is always `undefined`. Always pass `channelId`.

> [!WARNING]
> `createWidgetScopedLocalStorage().setItem` skips the write when `widgetToken` is not set, and the persisted `Chat` rehydrates with whatever token is current at startup. When the token changes at runtime, `handleHelloData` reads `` `${fullWidgetToken}_persist:Chat` `` by hand and dispatches `setNotifications`. Keep that in step if you change the key or the whitelist. <!-- verify:ignore -->

> [!WARNING]
> sessionStorage `widgetToken`, `tab_session_id`, `helloConfig` and `persist:appInfo`, and localStorage `__session_backup_widgetToken`, are not widget-prefixed. Two widget iframes from this origin in the same tab share them, and the backup is shared by every tab. <!-- verify:ignore -->

> [!TODO] Needs a human: is more than one widget per host page supported? If so, the unprefixed sessionStorage `widgetToken` is overwritten by whichever iframe loaded last.

A full `localStorage.clear()` from another tab fires a `storage` event with `key === null`; `hooks/CORE/eventHandlers/localStorage/localStorageEventsHandler.ts` then resets `draftData` and `appInfo` and emits `RELOAD_PARENT` to the host page.

## How to change safely

1. Adding a field to an existing keyed slice: add it to the TS interface in `types/`, write it with the existing merge actions (`setHelloKeysData`, `setDataInAppInfoReducer`) unless you need logic.
2. Adding a reducer to `Hello`: read the key from `action.urlData?.chatSessionId` and guard on it, like every other case in `store/hello/helloReducer.ts`. Remember it will be broadcast to other tabs and persisted.
3. Adding a slice: register it in `store/combineReducer.js`, then decide persistence (`rootPersistConfig.blacklist` or its own `persistReducer`) and sync (the predicate in `store/index.js`) explicitly.
4. Changing a persisted shape: there are no migrations at `version: 1`. Old shapes rehydrate as-is; make readers tolerate missing or old fields, or bump the version and add a `migrate`.
5. Test in a second tab (sync), after an iframe reload (rehydrate), and with storage blocked (e.g. Safari with cross-site tracking prevention) before shipping storage changes.
