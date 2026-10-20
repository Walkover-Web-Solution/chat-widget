---
covers: ["public/chat-widget*.js", "public/chatbot*.js", "public/rag-*.js", "public/urlMonitor.js", "utils/emitEventsToParent/**", "hooks/CORE/eventHandlers/embeddingScript/**", "hooks/HELLO/eventHandlers/embeddingScript/**", "hooks/GTWY/eventHandlers/embeddingScript/**", "config/api.ts", "config/helloApi.ts", "config/ragApi.ts", "config/regionConfig.ts", "utils/interceptor.ts", "utils/helloInterceptor.ts", "hooks/socket*", "hooks/notifications/**", "components/Chatbot/hooks/useRtlayerEventManager.tsx", "app/rag/page.tsx"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# API

This repo is a frontend only. There is no app/api folder and no server routes of its own. Its "API" is three things:

1. The **host-page JS API** that the embed scripts in `public/` put on `window` of the customer's site.
2. The **postMessage protocol** between those scripts (host page) and the iframe that loads this Next app.
3. The **backend calls** the iframe (and the host scripts) make to GTWY, MSG91 Hello, RAG, push, rtlayer and socket.io servers. Those backends live in other repos.

Page routes of the Next app: `/chatbot` (widget iframe, also `/chatbot/[chatbotId]`), `/chatbotpreview`, `/rag`, `/` (create-next-app placeholder). Details in [ui/routes.md](ui/routes.md).

How the scripts work internally (subdomain namespacing, handshake, env-variant drift): [modules/embed-scripts.md](modules/embed-scripts.md). Env vars and base URLs: [environment.md](environment.md).

## 1. Host-page JS API

### Hello chat widget — `public/chat-widget.js` (+ `-dev`, `-local`)

`window.chatWidget[<subdomain>]` holds the methods. `<subdomain>` is the first label of the script's hostname, or the port when the script is served from `localhost`. For the legacy subdomains in `isLegacySubdomain` (`blacksea`, `ctest`, and `3001` in `-local`) the methods are also copied flat onto `window.chatWidget`. `window.initChatWidget(data, delay)` forwards to the **last loaded** script's subdomain. Prod and dev also set `window[<subdomain>_helloChatbotManager]`.

| Method | Effect (message sent to iframe) |
|---|---|
| `initChatWidget(data, delay = 0)` | Stores `data` as `helloProps`; sent as `helloData` once the iframe posts `interfaceLoaded` and `delay` ms passed. `variables` also go as `SET_VARIABLES_FOR_BOT`; `previewLinks` loads `public/urlMonitor.js`. Ignored after `initializeHelloChat_failed`. |
| `SendDataToBot(data)` | With `variables`: `SET_VARIABLES_FOR_BOT` only. Otherwise applies `parentId`, `hide_launcher`, `launch_widget`, `config` on the host, posts `helloRunTimeData` (and `askAi` if `data.askAi`). |
| `addCustomData(d)`, `modifyCustomData(d)` | `UPDATE_USER_DATA_SEGMENTO` → iframe calls `saveClientDetails`. |
| `addUserEvent(d)` | `ADD_USER_EVENT_SEGMENTO` → iframe calls `addDomainToHello({ userEvent })`. |
| `open(id?)` / `close()` / `toggleWidget()` | `open` + `CHATBOT_OPEN {id}` / `CHATBOT_CLOSE`. `id` opens that ticket. |
| `openWithMessage(message, autoSend = true, alwaysNewChat = true)` | Opens, then `SEND_INITIAL_MESSAGE`. |
| `hide()` / `show()` | Host-only: hide launcher and panel / show launcher. |
| `showTicket(id)` | `SHOW_TICKET`. |
| `getTicketUnreadCount(id)` | `GET_TICKET_UNREAD_COUNT`; returns a Promise resolved by `TICKET_UNREAD_COUNT`, or `0` after 5 s. `id = '*'` sums all channels. |
| `handlePushNotification(data)` | Host-only: renders a push-notification modal. |
| `shutdown()` | `SHUTDOWN_CHATBOT` → iframe forgets the client ids (logout). |
| `initUrlTracker({ urls })` | Added to `window.chatWidget` by `public/urlMonitor.js`. Opens matching links in a side panel instead of navigating. |

`initChatWidget` config keys read in this repo (all optional except `widgetToken`):

```ts
{
  widgetToken: string,
  unique_id?, mail?, number?, name?, user_jwt_token?,     // identified user
  hide_launcher?: boolean|'true'|'false', launch_widget?: boolean|'true'|'false',
  parentId?: string, icon_position?: 'left'|'right', icon_bottom_margin?: number|string,
  variables?: object, previewLinks?: string[],
  theme?: 'light'|'dark'|'system', sdkConfig?: { customTheme?, theme? },
  isMobileSDK?: boolean, pushConfig?: object, hideFullScreenButton?: boolean,
  config?: { type, height, heightUnit, width, widthUnit, buttonName, iconUrl }
}
```

> [!WARNING]
> Any key that is not a Hello client field must be added to `keysToRemove` in `components/Chatbot/hooks/useHelloEffects.ts`, or it is sent to `PUT /v2/client/<clientId>` as client data.

### GTWY chatbot — `public/chatbot.js` (+ `-dev`, `-local`)

Configured by attributes on `<script id="chatbot-main-script">`: `interfaceId`, `embedToken`, `threadId`, `bridgeName`, `variables`, `onOpen`, `onClose`, `iconColor`, `className`, `style`, `environment`, `fullScreen`, `hideCloseButton`, `hideIcon`, `parentId`, `config`, `headerButtons`, `eventsToSubscribe`, `modalConfig`, `allowModalSwitch`, `chatTitle`, `chatIcon`, `hideFullScreenButton`, `defaultOpen`. JSON values: `config`, `headerButtons`, `eventsToSubscribe`, `modalConfig`. Anonymous mode reads the attribute `interface_id` (see [embed-scripts](modules/embed-scripts.md#gotchas)).

| Global | Effect |
|---|---|
| `window.Chatbot.open()` / `.close()` / `.show()` / `.hide()` | Panel and launcher visibility. |
| `window.Chatbot.reloadChats()`, `window.reloadChats()` | Posts `refresh`. |
| `window.Chatbot.askAi(data)`, `window.askAi(data)` | Posts `askAi`. |
| `window.Chatbot.sendData(data)`, `window.SendDataToChatbot(data)` | Object or JSON string. Applies `parentId`, `hideCloseButton`, `hideIcon`, `iconColor`, `fullScreen`, `config` on the host, posts `interfaceData` (and `askAi`). |
| `window.openChatbot()`, `window.closeChatbot()` | Same as `open` / `close`. |

When `window.ReactNativeWebView` exists, open/close/data are mirrored to it as JSON strings.

### RAG knowledge-base embed — `public/rag-prod.js` (+ `rag-dev.js`, `rag-local.js`)

Configured by attributes on `<script id="rag-main-script">`: `embedToken`, `chunkingType`, `hideConfig`, `listPage`, `onOpen`, `onClose`, `className`, `parentId`, `config`, `hideIcon`, `theme`, `defaultOpen`. The three files differ only in the four URLs in the `RagEmbedManager` constructor (`ragUrl`, `login`, `docsApi`, `cssURL`).

| Global | Effect |
|---|---|
| `window.ragEmbed.{openRag, closeRag, showDocuments, closeDocuments, updateConfig(config), destroy}` | Open the `/rag` iframe, close it, show/hide the host-side document list, change config, remove everything. |
| `window.openRag`, `window.closeRag`, `window.showDocuments`, `window.closeDocuments`, `window.updateConfig`, `window.destroy` | Same functions as bare globals. |
| `window.RagEmbedManager` | The manager instance. |

> [!WARNING]
> The RAG script defines very generic globals (`window.destroy`, `window.updateConfig`) that can clash with the host page's own code.

## 2. postMessage protocol

Envelope: `{ type, data }`. Both directions use target origin `'*'`. The iframe side does **no** `event.origin` check: `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:useEmbeddingScriptEventHandler` dispatches any message whose `type` was registered with `addEventHandler`; other types are ignored. The Hello host script accepts only messages whose origin is the script origin or the host origin **and** whose `event.source` is its own iframe.

### Host → iframe (`/chatbot`)

| type | Sent by | `data` keys | Handled by |
|---|---|---|---|
| `helloData` | Hello, after handshake | the `initChatWidget` config | `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` `handleHelloData` |
| `helloRunTimeData` | Hello `SendDataToBot` | `themeColor`, `tagline`, `show_widget_form`, `variables`, `fullScreen` | HELLO handler |
| `SET_VARIABLES_FOR_BOT` | Hello init / `SendDataToBot` | `variables` (prod adds `name`) | HELLO handler |
| `CHATBOT_OPEN` / `CHATBOT_CLOSE` | Hello open/close | `id?` | HELLO handler |
| `open` | Hello and GTWY on open | `{}` | `components/Interface-Chatbot/ChatbotTextField.tsx` (focus input) |
| `SEND_INITIAL_MESSAGE` | `openWithMessage` | `message`, `autoSend`, `alwaysNewChat` | HELLO handler |
| `STARTER_QUESTION_OPTION_CLICKED` | Hello starter bubble | `option` | HELLO handler |
| `SHOW_TICKET` / `GET_TICKET_UNREAD_COUNT` | Hello API | `id` | HELLO handler |
| `SHUTDOWN_CHATBOT` | `shutdown()` | – | HELLO handler |
| `UPDATE_USER_DATA_SEGMENTO` | `addCustomData`, `modifyCustomData` | user fields (`name`/`mail`/`number` renamed to `Name`/`Email`/`Phonenumber`) | `handleUpdateUserDataSegmento` → `saveClientDetails` |
| `ADD_USER_EVENT_SEGMENTO` | `addUserEvent` | event object | `handleAddUserEventSegmento` → `addDomainToHello` |
| `parent-route-changed` | Hello, after `ENABLE_DOMAIN_TRACKING` | `websiteUrl` | `handleParentRouteChanged` → `addDomainToHello` |
| `ADD_COBROWSE_SCRIPT` | Hello, after CobrowseIO starts on host | `origin` | `handleAddCoBrowseScript` → `hooks/coBrowser/CBManger.ts` |
| `OPEN_WITH_NOTIFICATION` | Hello launcher preview click | `content`, `notificationId` | HELLO handler |
| `askAi` | Hello and GTWY | string, or `{ askAi \| message, variables, threadId, bridgeName }` | `components/Chatbot/hooks/useChatEffects.ts` (GTWY users only) |
| `interfaceData` | GTWY, on `interfaceLoaded` and `sendData` | `threadId`, `bridgeName`, `helloId`, `version_id`, `variables`, `modelChanged`, `serviceChanged`, `headerButtons`, `eventsToSubscribe`, `modalConfig`, `allowModalSwitch`, `chatTitle`, `chatSubTitle`, `chatIcon`, `allowBridgeSwitch`, `hideCloseButton`, `hideFullScreenButton` | `hooks/GTWY/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` `handleInterfaceData` |
| `refresh` | GTWY `reloadChats` | `{ type: 'refresh', reload: true }` (no `data`) | `useChatEffects.ts` |

`eventsToSubscribe` is filtered against `ALLOWED_EVENTS_TO_SUBSCRIBE` in `utils/enums.ts`.

### Iframe → host

Typed sender: `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent`, whose `ParentEventType` lists the allowed types. Some messages bypass it and call `window.parent.postMessage` directly (marked "direct").

| type | `data` | Emitted from | Host handling |
|---|---|---|---|
| `interfaceLoaded` (direct) | – | `components/Chatbot-Wrapper/ChatbotWrapper.tsx` | Hello: show launcher, send `helloData`. GTWY: send `interfaceData`. |
| `CLOSE_CHATBOT` | – | `ChatbotHeader.tsx`, `ChatbotDrawer.tsx`, `app/error.tsx` (direct) | close panel |
| `OPEN_CHATBOT` | – | `useHelloEffects.ts`, `HelloVoiceService.ts` | open panel (Hello) |
| `MINIMIZE_CHATBOT` | – | `ChatbotHeader.tsx` | 60px bar (Hello) |
| `ENTER_FULL_SCREEN_CHATBOT` / `EXIT_FULL_SCREEN_CHATBOT` (direct) | – | `ChatbotHeader.tsx` | resize |
| `initializeHelloChat_failed` (direct) | – | `useHelloEffects.ts` | Hello removes the widget and blocks `initChatWidget` |
| `hide_widget` / `launch_widget` (direct) | boolean from widget-info | `useHelloEffects.ts` | launcher visibility / auto-open, unless the host passed the key |
| `setDataInLocal` (direct) | `key`, `payload` | `utils/utilities.js`, `useHelloEffects.ts` | writes host localStorage (`hello-widget-uuid`, `hello-widget-anonymoud-uuid`, `widgetInfo`) |
| `uuid` | `uuid` | `useHelloEffects.ts` | starts CobrowseIO on the host |
| `ENABLE_DOMAIN_TRACKING` | – | `useHelloEffects.ts` | host reports URL changes via `parent-route-changed` |
| `SET_BADGE_COUNT` | `badgeCount` (number or `'99+'`), `channelId` (`'*'` = launcher) | `useHelloEffects.ts`, `store/hello/helloReducer.ts` | launcher badge, element `#unread-<channelId>` |
| `TICKET_UNREAD_COUNT` | `id`, `count` | HELLO handler | resolves `getTicketUnreadCount` |
| `SHOW_STARTER_QUESTION` / `HIDE_STARTER_QUESTION` | `message`, `options` / – | `useHelloEffects.ts`, `useHelloIntegration.ts` | starter bubble |
| `PUSH_NOTIFICATION` | notification `message` (`message_type` `Popup`/custom) | `hooks/notifications/notificationSocketEventHandler.tsx` | modal |
| `LAUNCHER_MESSAGE_PREVIEW` | `message` + `notificationId` | same | preview bubble; click echoes `OPEN_WITH_NOTIFICATION` |
| `downloadAttachment` (direct) | `url` | `components/Interface-Chatbot/Messages/ImageWithFallback.tsx` | host downloads the file |
| `RELOAD_PARENT` | – | `hooks/CORE/eventHandlers/localStorage/localStorageEventsHandler.ts` | `location.reload()` |
| `FRONT_END_ACTION` | action `variables` | `utils/ChatbotUtility.ts:perFormAction` | not handled by the scripts; for the host's own listener |
| `HEADER_BUTTON_PRESS` | header button item (+ `selectedOption`) | `ChatbotHeader.tsx` | host's own listener |
| `MESSAGE_CLICK` | the message | `components/Interface-Chatbot/Messages/UserMessage.tsx` | host's own listener |
| `BRIDGE_SWITCH` | selected bridge object | `ChatbotHeader.tsx` | host's own listener |

The GTWY script handles only `interfaceLoaded`, `CLOSE_CHATBOT` and the fullscreen pair.

> [!WARNING]
> Adding or renaming a type needs both sides: `ParentEventType` plus a `case` in all three `public/chat-widget*.js`, or `addEventHandler` in the HELLO/GTWY hook for the other direction. Unknown types are dropped silently.

### RAG (`/rag` iframe ↔ `public/rag-*.js`)

| Direction | type | data |
|---|---|---|
| host → iframe | `INITIAL_CONFIG` | script attributes + `token` (sent once, after `ragLoaded`) |
| host → iframe | `OPEN_ADD_DOCUMENT`, `EDIT_DOCUMENT` (`document`), `DELETE_DOCUMENT` (`document._id`) | every message also gets `token`, `timestamp` |
| iframe → host | `ragLoaded`, `closeRag` | – |
| iframe → host | `rag` | `status`: `create`/`update`/`delete`, `data` |
| iframe → host | `iframe-message-rag` | `status`, `error` or `data` |

The host script also accepts `CLOSE_RAG`, `OPEN_RAG`, `SHOW_DOCUMENT_LIST`, and posts `open` / `close` to its own `window.parent`. `app/rag/page.tsx` handles the four host types and stores `INITIAL_CONFIG.token` as sessionStorage `ragToken`.

## 3. Backend calls

Two axios instances add auth:

- `utils/interceptor.ts` (GTWY + RAG): if the URL contains `rag`, header `proxy_auth_token` = sessionStorage `ragToken`; else `Authorization` = sessionStorage `interfaceToken` (set by `app/chatbot/page.tsx` from the `token` in `interfaceDetails`, i.e. the GTWY loginuser response). A **401** removes the cookie named by `REACT_APP_API_ENVIRONMENT` (`utils/utilities.js:getCurrentEnvironment`), clears all of the iframe origin's localStorage (every widget's Hello ids too) and redirects the iframe to `/?error=session expired`. 5xx shows a toast.
- `utils/helloInterceptor.ts` (Hello): no request hook; each call sets `authorization` itself.

> [!WARNING]
> The `rag` substring test runs on the full URL. Any non-RAG GTWY URL that happens to contain `rag` (for example a thread or bridge slug in the path) is sent with the RAG token instead of `Authorization`.

### GTWY Python API — `NEXT_PUBLIC_PYTHON_API_BASE_URL` (`PYTHON_URL` in `config/api.ts`)

| Method | Path | Function | Caller | Notes |
|---|---|---|---|---|
| POST | `/chatbot/{chatBotId}/sendMessage` | `config/api.ts:sendDataToAction` | `components/Chatbot/hooks/useChatActions.ts:useSendMessage` | Body: `message`, `images`, `files`, `userId`, `interfaceContextData`, `threadId`, `subThreadId`, `slugName`, `thread_flag`, `chatBotId`, `version_id`, optional `configuration.model`, `service`. Response body ignored; the answer arrives on rtlayer. Error → toast from `detail.error`/`detail`. |
| POST | `/image/processing/` | `config/api.ts:uploadImage` | `components/Interface-Chatbot/ChatbotTextField.tsx` | multipart `formData`; returns uploaded URL data. |

### GTWY Node API — `NEXT_PUBLIC_API_BASE_URL` (`URL` in `config/api.ts`)

| Method | Path | Function | Caller | Notes |
|---|---|---|---|---|
| GET | `/api/v1/config/gethistory-chatbot/{threadId}/{bridgeName}?sub_thread_id&pageNo&limit` | `config/api.ts:getPreviousMessage` | `components/Chatbot/hooks/useChatActions.ts:useGetInitialChatHistory`, `useGetMoreChats` | `limit` = `PAGE_SIZE.gtwy` (40). Returns `data` (reversed client-side) and `starterQuestion`. One shared AbortController: a new call cancels the previous one. Returns `[]` on error. |
| GET | `/thread/{threadId}?slugName=` | `config/api.ts:getAllThreadsApi` | `components/Chatbot/hooks/useChatActions.ts:useFetchAllThreads` | sub-thread list. |
| PUT | `/api/v1/config/status/{feedbackStatus}` | `config/api.ts:sendFeedbackAction` | `components/Chatbot/hooks/useChatActions.ts:useMessageFeedback` | body `{ message_id }`. |
| POST | `/hello/subscribe` | `config/api.ts:getHelloDetailsApi` | `store/hello/helloGeneratorFunctions.ts:getHelloDetailsSaga` | body `slugName`, optional `threadId`, `helloId`, `versionId`. Despite the name, a GTWY call; saga stores the agent auth as localStorage `HelloAgentAuth`. |
| GET | `/rag/get-emebed-token` (sic) | `config/api.ts:getEmebedToken` | `app/rag/page.tsx` | returns `token` for the viaSocket embed. |

Host-side GTWY calls (not via axios): `public/chatbot.js:ChatbotEmbedManager` posts to the hard-coded `urls.login` (`https://db.gtwy.ai/chatbot/loginuser`; `-dev`: `dev-db.gtwy.ai`) with header `Authorization: <embedToken>`, or anonymous body `{ isAnonymousUser: true, interface_id }`. Its `data` becomes the iframe's `interfaceDetails`.

**Unused exports in `config/api.ts`** (no importer at `b9ab6d6`; their backend routes may no longer exist): `getAllInterfaceApi`, `createInterfaceApi`, `updateInterfaceApi`, `updateInterfaceActionsApi`, `updateInterfaceDetailsApi`, `deleteInterfaceApi`, `getInterfaceByIdApi`, `deleteComponentOrGridApi`, `performChatAction`, `loginUser`, `getHelloChatsApi` (hard-coded `api.phone91.com`), `createScripts`, `createNewThreadApi`, `sendMessage`, `allChats`, `getAccessToken`, `getTemplateFlowList` (hard-coded viaSocket project URL). Do not assume they work; check the backend before reviving one.

### RAG API — `NEXT_PUBLIC_API_BASE_URL` (`config/ragApi.ts`), header `proxy_auth_token`

| Method | Path | Function | Caller | Notes |
|---|---|---|---|---|
| POST | `/rag` | `config/ragApi.ts:createKnowledgeBaseEntry` | `app/rag/page.tsx` | multipart: `name`, `description`, `chunking_type`, `chunk_size`, `chunk_overlap`, `file` or `url`; or JSON `{ name, description, url }` from a viaSocket "published" event. |
| PATCH | `/rag/docs/{id}` | `config/ragApi.ts:updateKnowBaseData` | `app/rag/page.tsx` | `name`, `description`, chunk fields. |
| DELETE | `/rag/docs/{id}` | `config/ragApi.ts:deleteKnowBaseData` | `app/rag/page.tsx` | body `{ id }`. |
| GET | `/rag/docs` | `config/ragApi.ts:getAllKnowBaseData` | unused | the host script lists docs itself. |

Host-side (`public/rag-prod.js`): `GET <login>` (`https://db.gtwy.ai/user/embed/login`) with `Authorization: <embedToken>` → token from `data.token` or `accessToken`; `GET <docsApi>` (`https://db.gtwy.ai/rag/docs`) with `Proxy_auth_token`. `app/rag/page.tsx` also loads `https://embed.viasocket.com/prod-embedcomponent.js` and trusts `message` events from `https://embedfrontend.viasocket.com`.

### MSG91 Hello API — base `config/regionConfig.ts:getHelloHostUrl`

Base URL = region URL from `POST /routing-region/` (set by `setRegionUrls`), else `NEXT_PUBLIC_MSG91_HOST_URL`, else stage host when `?env=stage`. It is resolved per call. All functions are in `config/helloApi.ts`. `authorization` is `WidgetId` alone or `getAuthorization()` = `"<WidgetId>:<k_clientId or a_clientId>"`. Every body also carries `user_data` (`getUserData`). Full semantics: [integrations/hello.md](integrations/hello.md).

| Method | Path | Function | Auth | Caller |
|---|---|---|---|---|
| POST | `/routing-region/` | `getRoutingRegion` | WidgetId | `components/Chatbot/hooks/useHelloEffects.ts` |
| POST | `/widget-info/` | `initializeHelloChat` | WidgetId | `useHelloEffects.ts` |
| POST | `/anonymous-client-details/` | `registerAnonymousUser` | WidgetId | `useHelloEffects.ts` |
| POST | `/pubnub-channels/list/` | `getAllChannels` | WidgetId[:clientId] | `components/Chatbot/hooks/useHelloIntegration.ts:useFetchChannels` — body `name`, `mail`, `number`, `unique_id`, `anon_client_uuid?`, merge params; fields at top level of `response.data` |
| GET | `/jwt-token/` | `getJwtToken` | WidgetId:clientId | `useHelloEffects.ts` (socket JWT) |
| POST | `/agent-team/` | `getAgentTeamApi` | WidgetId:clientId | `useHelloEffects.ts` |
| POST | `/chat-bot/welcome/get-welcome/` (lex) · GET `/chat-gpt/greeting/` | `getGreetingQuestions` | WidgetId[:clientId] | `useHelloEffects.ts` — `company_id`, `bot_id` |
| PUT | `/v2/client/{clientId}` | `saveClientDetails` | WidgetId:clientId | `useHelloEffects.ts`, `components/FormComponent.tsx`, HELLO handler |
| POST | `/get-history/` | `getHelloChatHistoryApi`, `getFullMessageApi` | WidgetId:clientId | `components/Chatbot/hooks/useHelloIntegration.ts:useFetchHelloPreviousHistory`, `useGetMoreHelloChats`; `components/Interface-Chatbot/Messages/ReadMoreText.tsx` — `channel`, `origin: "chat"`, `page_size` (30) + `start_from`, or `message_id` |
| POST | `/v2/send/` | `sendMessageToHelloApi` | WidgetId:clientId | `components/Chatbot/hooks/useHelloIntegration.ts:useOnSendHello` — `type` (`widget`/`trial_bot`), `message_type`, `content.text`, `content.attachment`, `chat_id` or `channelDetail`, `widget_msg_id`, `replied_on?`, `sessionVariables` |
| POST | `/v2/upload/?type=chat&inbox_id=` | `uploadAttachmentToHello` | WidgetId:clientId | `ChatbotTextField.tsx` |
| DELETE | `/read-receipt/{channelId}` | `deleteReadReceipt` | WidgetId:clientId | `useHelloEffects.ts` |
| POST | `/receive-feedback/` | `submitFeedback` | WidgetId:clientId | `components/Hello/RenderHelloFeedbackMessage.tsx` — `feedback_msg`, `rating`, `token`, `id`, `type: "post-feedback"` |
| GET | `/web-rtc/get-client-token/` | `getClientToken` | WidgetId:clientId | `useHelloEffects.ts` (calling) |
| GET | `/web-rtc/get-call-token/` | `getCallToken` | WidgetId:clientId | unused (call commented out) |
| PUT | `/add-domain/` | `addDomainToHello` | WidgetId:clientId | HELLO handler — `dom` and/or `event_data` |

### Push notifications — `NEXT_PUBLIC_PUSH_NOTIFICATION_URL`

| Method | Path | Function | Auth | Caller |
|---|---|---|---|---|
| POST | `/add-user-fcm-token/` | `config/helloApi.ts:subscribeForFCMPushNotification` | `authorization: <Hello socket JWT>` | `hooks/notifications/notificationSocket.ts:useNotificationSocket`, only when `isMobileSDK` and `pushConfig` has `access_token` or `fcm`; body = `pushConfig` + `user_channel` |

### Realtime channels

| Transport | Client | Connect | Channels | Events |
|---|---|---|---|---|
| socket.io, Hello chat | `hooks/socketManager.js` (singleton) | `getSocketUrl()`, `auth.token` = Hello socket JWT (`GET /jwt-token/`) | `ch-comp-<company_id>-<clientId>` (`hooks/socket.js`), each `channelListData.channels[].channel`, `widgetInfo.event_channels` | emit `subscribe` / `unsubscribe` `{ channel: [...] }`; emit `typing` / `not-typing` `{ channel, data: { action, channel } }` (`hooks/socketEventEmitter.ts:useTypingStatus`); listen `NewPublish`, `Typing` (`hooks/socketEventHandler.ts:useSocketEvents`) |
| socket.io, notifications | `hooks/notifications/notificationSocketManager.ts` | `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` (sic), same JWT | `ch-comp-<company_id>.<uuid>` (dot, not dash) | listen `NewPublish` with `message.type === 'notification'` (`useNotificationSocketEventHandler`) |
| rtlayer, GTWY AI replies | `components/Chatbot/hooks/useRtlayerEventManager.tsx` (`rtlayer-client`) | keys hard-coded in `useWebSocketClient` (not opened for Hello users) | `(chatSessionId + (threadId \|\| userId) + (subThreadId \|\| userId))` with spaces → `_` | payload branches: `status`, `response.function_call`, `error`, `data.role`, `data.suggestions`, `data.display_name`, final `data`. See [flows/ai-message.md](flows/ai-message.md). |

> [!WARNING]
> The rtlayer channel string must equal what the GTWY backend publishes to. A mismatch shows no error: the user waits until the 240 s timeout.

### Other third parties called from the iframe

- `https://flow.sokt.io/func/<apiCallId>` — table pagination in `components/Interface-Table/InterfaceTable.tsx` (plain axios, no auth).
- `https://api.microlink.io/` — link previews in `components/Hello/AppleInteractiveMessage.tsx`.
- `https://js.cobrowse.io/CobrowseIO.js` — loaded by `hooks/coBrowser/CBManger.ts` and by the Hello host script.
