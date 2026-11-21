---
covers: ["app/chatbot/**", "public/chat-widget*.js", "public/urlMonitor.js", "config/helloApi.ts", "hooks/HELLO/eventHandlers/**", "utils/emitEventsToParent/**"]
verified_at: 6667018
verified_on: 2026-11-20
---
# API

This repo serves no HTTP API. It is a Next.js frontend that runs inside an iframe on customer sites. Its external surface is three things, and this page is the single list of each:

1. [Page routes](#page-routes) the iframe loads.
2. [Host-page JS API](#host-page-js-api): the `window.chatWidget` methods, `initChatWidget` config keys, and the `postMessage` protocol between the host page and the iframe.
3. [Outbound backend calls](#outbound-backend-calls) to MSG91 Hello.

Deep explanations live in the module docs: embed-script internals in [embed-script](modules/embed-script.md), the iframe side in [app-shell](modules/app-shell.md), Hello request/response shapes in [hello-api](integrations/hello-api.md), the boot order in [widget-boot](flows/widget-boot.md). Hosts and env vars are in [environment](environment.md).

## Page routes

App Router pages under `app/`. Both chatbot pages export `runtime = 'edge'` for the Cloudflare Pages build.

| Path | File:symbol | Query params read | Behaviour |
|---|---|---|---|
| `/chatbot` | `app/chatbot/page.tsx:InterfaceEmbed` | `env` (only `stage` is kept) | Entry the embed script loads. Creates sessionStorage `tab_session_id` if missing, dispatches it to draftData, then `router.replace('/chatbot/hello')` (plus `?env=stage` when set). Renders a spinner only. |
| `/chatbot/hello` | `app/chatbot/[chatbotId]/page.tsx` (default export `Chatbot`) | none in the page; `env` is read at module load by `config/regionConfig.ts`, `hooks/notifications/notificationSocketManager.ts` and `components/Chatbot/hooks/HelloVoiceService.ts` | Renders `ChatbotWrapper`. The `[chatbotId]` segment is never read; `hello` is the only value used. |
| `/` | `app/page.tsx:Home` | none | Untouched create-next-app boilerplate. Not used by the widget. |

The embed script also appends `interfaceDetails={"isHelloUser":true}` to the `/chatbot` URL. No code reads it (its reader was removed in 9a37b80).

> [!WARNING]
> Always enter through `/chatbot`. Opening `/chatbot/hello` directly skips `InterfaceEmbed`, leaves `tabSessionId` empty and makes every tab share one appInfo slot. See [app-shell](modules/app-shell.md#which-page-the-iframe-loads).

Static files from `public/` are part of the surface too: `public/chat-widget.js` (production embed), `public/chat-widget-dev.js`, `public/chat-widget-local.js`, `public/chat-widget-style.css` and `public/urlMonitor.js` (loaded by the embed script from its own origin), and `public/notification-sound.mp3` (played by `utils/utilities.js`).

## Host-page JS API

A customer adds `<script src="https://<subdomain>.<host>/chat-widget.js">` and calls `window.initChatWidget(config, delay)`. The script keys everything on `subdomain` (first DNS label of the script host, or the port on `localhost`), so several widgets can share one page. Source of truth: `public/chat-widget.js:windowMethods`; keep `public/chat-widget-dev.js` and `public/chat-widget-local.js` in step (see [embed-script](modules/embed-script.md#prod-dev-and-local-copies)).

### Window methods

Call as `window.chatWidget[<subdomain>].<method>(...)`. For the legacy subdomains `blacksea` and `ctest` (plus `3001` in the local script) the same methods are also flat on `window.chatWidget`. All are defined in `public/chat-widget.js:windowMethods` unless noted.

| Method | Arguments | Effect (event posted to the iframe) |
|---|---|---|
| `initChatWidget` | `data: object, delay = 0` | Stores `data` as `helloProps`; `SET_VARIABLES_FOR_BOT` if `variables`; after `delay` ms the iframe gets `helloData`. No-op after `initializeHelloChat_failed`. |
| `SendDataToBot` | `data: object` | With `variables`: only `SET_VARIABLES_FOR_BOT`. Otherwise applies UI keys and posts `helloRunTimeData` (and `askAi` if `data.askAi`). |
| `addCustomData` / `modifyCustomData` | `data: object` | `UPDATE_USER_DATA_SEGMENTO` |
| `addUserEvent` | `data: object` | `ADD_USER_EVENT_SEGMENTO` |
| `open` | `id = ""` | Opens; `CHATBOT_OPEN { id }` (an `id` opens that ticket) |
| `openWithMessage` | `message = "", autoSend = true, alwaysNewChat = true` | Opens, then `SEND_INITIAL_MESSAGE` if `message` |
| `close` | none | Closes; `CHATBOT_CLOSE` |
| `hide` / `show` | none | Hide launcher and widget / show launcher (host DOM only) |
| `toggleWidget` | none | Open if hidden, else close |
| `handlePushNotification` | `data` | Renders a push popup on the host page (host DOM only) |
| `showTicket` | `id` | `SHOW_TICKET { id }` |
| `getTicketUnreadCount` | `id` (`'*'` = all) | `GET_TICKET_UNREAD_COUNT`; returns `Promise<number>`, resolved by `TICKET_UNREAD_COUNT` or `0` after 5 s |
| `shutdown` | none | `SHUTDOWN_CHATBOT` (logout: clears client ids) |
| `window.initChatWidget` | `data, delay = 0` | Global alias for `window.chatWidget[<subdomain>].initChatWidget` of the script that ran last |
| `window.chatWidget.initUrlTracker` | `{ urls: string[] }` | Defined flat by `public/urlMonitor.js` (only loaded when `previewLinks` is set) |

> [!WARNING]
> `window.initChatWidget` points at whichever widget script loaded last. With two widgets on a page, call `window.chatWidget[<subdomain>].initChatWidget`. If `initChatWidget` is never called, the iframe never receives `helloData` and the widget never starts.

### `initChatWidget` config keys

The object is used twice: the embed script reads some keys for host-side UI, then posts the whole object as `helloData`. The iframe saves it in sessionStorage `helloConfig` and Redux (`setHelloConfig`) in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:handleHelloData`.

| Key | Type | Read by | Effect |
|---|---|---|---|
| `widgetToken` | string, **required** | `handleHelloData` | Widget id; prefixes every widget-scoped storage key |
| `unique_id` | string | `handleHelloData`, `config/helloApi.ts:getUserData` | Known-user id; session becomes `<widgetToken>_<unique_id>` |
| `mail`, `number`, `name` | string | `handleHelloData`, `components/FormComponent.tsx` | Identity; all three present hides the contact form; prefilled fields are disabled |
| `user_jwt_token` | string | `handleHelloData` | Kept only with `unique_id`/`mail`/`number`; sent in `user_data` |
| `theme` | `'light'\|'dark'\|'system'` | `handleHelloData` | Colour mode |
| `sdkConfig` | `{ customTheme?, theme? }` | `handleHelloData` | Primary colour hex and mode override |
| `variables` | object | `handleSetVariablesForBot`, `handleHelloData` | Bot variables (`setVariablesForHelloBot`) |
| `hide_launcher` | bool or `'true'`/`'false'` | `public/chat-widget.js:showIconIfReady` | Launcher hidden; presence overrides the server `hide_widget` |
| `launch_widget` | bool or `'true'` | `public/chat-widget.js` | Open on ready; presence overrides the server value |
| `parentId` | element id | `public/chat-widget.js:changeContainer`, `components/Interface-Chatbot/ChatbotHeader.tsx` | Mount inside that element instead of a popup |
| `isMobileSDK` | bool | `public/chat-widget.js`, `components/Interface-Chatbot/ChatbotHeader.tsx`, `hooks/notifications/notificationSocket.ts` | Native WebView mode: no launcher, events go to the [mobile channel](modules/embed-script.md#mobile-sdk-channel) |
| `pushConfig` | object | `hooks/notifications/notificationSocket.ts` | Mobile SDK FCM registration |
| `icon_position`, `icon_bottom_margin` | `'left'\|'right'`, number or CSS | `public/chat-widget.js:showIconIfReady` | Launcher placement |
| `previewLinks` | string[] | `public/chat-widget.js:addUrlMonitor` | Loads `public/urlMonitor.js` with these patterns |
| `starter_question`, `starter_question_text` | bool, string | `public/chat-widget.js:processDataProperties` | Bubble above the launcher |
| `hideCloseButton`, `iconColor`, `askAi`, `config` | | `public/chat-widget.js:processDataProperties` | Host UI; `config` = `{type,height,heightUnit,width,widthUnit,buttonName,iconUrl,title}` |
| `fullScreen` | bool or `'true'` | `components/Interface-Chatbot/ChatbotHeader.tsx`, `components/Interface-Chatbot/ChatbotDrawer.tsx` | Full-screen layout |
| `show_close_button`, `show_send_button` | bool | `components/Interface-Chatbot/ChatbotHeader.tsx`, `components/Interface-Chatbot/ChatbotDrawer.tsx`, `components/Interface-Chatbot/ChatbotTextField.tsx` | Hide close / send button when `false` |
| `show_widget_form` | bool | `components/Chatbot/Chatbot.tsx` | Contact form |
| `prefillMessage` | string | `components/Chatbot/Chatbot.tsx` | Text-field prefill (`openWithMessage` wins) |
| `viewMode` | `'ticket'` | `components/Interface-Chatbot/ChatbotTextField.tsx` | Ticket mode |
| `flow_origin`, `integration` | string | `config/helloApi.ts:getMergeParams` | "Widget merge": both must be set; spread into list/send bodies |

> [!WARNING]
> Any other key is not ignored. `components/Chatbot/hooks/useHelloEffects.ts` strips a fixed `keysToRemove` list from `helloConfig` and saves the rest as client properties through `saveClientDetails` (`PUT /v2/client/<id>`). A new config key must be added to `keysToRemove`, or it is stored on the customer's contact.

> [!WARNING]
> `iconColor` throws a `ReferenceError` in the embed script (undefined icon constants). See [embed-script](modules/embed-script.md#gotchas).

`SendDataToBot` payloads arrive in the iframe as `helloRunTimeData`; `handleHelloRuntimeData` reads only `themeColor`, `tagline`, `show_widget_form`, `fullScreen`, `variables`.

### postMessage: host page → iframe

Shape `{ type, data }`, posted with `contentWindow.postMessage(msg, '*')` by `public/chat-widget.js:sendMessageToChatbot`. The iframe dispatches through the registry in `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`; handlers below are in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` unless noted. Unregistered types are dropped.

| `type` | `data` keys | Sender (`public/chat-widget.js`) | Handler |
|---|---|---|---|
| `helloData` | whole config | `sendInitialData` | `handleHelloData` |
| `helloRunTimeData` | `SendDataToBot` payload | `processDataProperties` | `handleHelloRuntimeData` |
| `askAi` | `SendDataToBot` payload | `processDataProperties` | none (dropped) |
| `SET_VARIABLES_FOR_BOT` | `variables` (+ `name` in prod) | `subdomainInitFunction`, `windowMethods.SendDataToBot` | `handleSetVariablesForBot` |
| `CHATBOT_OPEN` | `id?` | `openChatbot`, `sendInitialData` | `handleChatbotVisibility(true, id)` |
| `CHATBOT_CLOSE` | none | `closeChatbot` | `handleChatbotVisibility(false)` |
| `open` | `{}` | `openChatbot` | `components/Interface-Chatbot/ChatbotTextField.tsx` (own listener, focuses input) |
| `SEND_INITIAL_MESSAGE` | `message`, `autoSend`, `alwaysNewChat` | `windowMethods.openWithMessage` | `handleSendInitialMessage` |
| `UPDATE_USER_DATA_SEGMENTO` | caller object (`name`, `mail`, `number`, …) | `windowMethods.addCustomData` | `handleUpdateUserDataSegmento` |
| `ADD_USER_EVENT_SEGMENTO` | caller object | `windowMethods.addUserEvent` | `handleAddUserEventSegmento` |
| `SHOW_TICKET` | `id` | `windowMethods.showTicket` | `handleShowTicket` |
| `GET_TICKET_UNREAD_COUNT` | `id` | `windowMethods.getTicketUnreadCount` | `handleGetTicketUnreadCount` |
| `SHUTDOWN_CHATBOT` | none | `windowMethods.shutdown` | `handleShutdownChatbot` |
| `STARTER_QUESTION_OPTION_CLICKED` | `option` | `createAndShowStarterQuestion` | `handleStarterQuestionOptionClicked` |
| `OPEN_WITH_NOTIFICATION` | `content`, `notificationId` | `showLauncherMessagePreview` | `handleOpenWithNotification` |
| `parent-route-changed` | `websiteUrl` | `enableDomainTracking` | `handleParentRouteChanged` |
| `ADD_COBROWSE_SCRIPT` | `origin` | `CobrowseManager` | `handleAddCoBrowseScript` |

> [!WARNING]
> The iframe does not check `event.origin` or `event.source` on incoming messages, and the host posts with target `'*'` (including `helloData`, which carries `user_jwt_token`). See [app-shell](modules/app-shell.md#gotchas).

### postMessage: iframe → host page

All go to `window.parent.postMessage(msg, '*')`. Types sent with `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent` must be in its `ParentEventType` union; the rest are posted directly. The host handles all of them in `public/chat-widget.js:handleIncomingMessages`, and only if `event.source` is its own iframe and the origin is the script's or the page's own.

| `type` | `data` keys | Sender | Host effect |
|---|---|---|---|
| `interfaceLoaded` | none | `components/Chatbot-Wrapper/ChatbotWrapper.tsx` | Ready signal; with the `initChatWidget` delay it triggers `helloData` |
| `initializeHelloChat_failed` | none | `components/Chatbot/hooks/useHelloEffects.ts` | Removes the widget DOM and blocks further init |
| `hide_widget` / `launch_widget` | bool | `components/Chatbot/hooks/useHelloEffects.ts` | Server launcher flags; ignored if the host passed `hide_launcher` / `launch_widget` |
| `OPEN_CHATBOT` | none | `components/Chatbot/hooks/useHelloEffects.ts`, `components/Chatbot/hooks/HelloVoiceService.ts` | `openChatbot` |
| `CLOSE_CHATBOT` | none | `app/error.tsx`, `components/Interface-Chatbot/ChatbotHeader.tsx`, `components/Interface-Chatbot/ChatbotDrawer.tsx` | `closeChatbot` |
| `MINIMIZE_CHATBOT` | none | `components/Interface-Chatbot/ChatbotHeader.tsx` | 60px bar |
| `ENTER_FULL_SCREEN_CHATBOT` / `EXIT_FULL_SCREEN_CHATBOT` | none | `components/Interface-Chatbot/ChatbotHeader.tsx` | `toggleFullscreen` |
| `uuid` | `uuid` | `components/Chatbot/hooks/useHelloEffects.ts` | `setUUID` (co-browse device id) |
| `SET_BADGE_COUNT` | `badgeCount`, `channelId` (`'*'` = launcher) | `components/Chatbot/hooks/useHelloEffects.ts`, `store/hello/helloReducer.ts` | Unread badges |
| `TICKET_UNREAD_COUNT` | `id`, `count` | `handleGetTicketUnreadCount` | Resolves `getTicketUnreadCount` |
| `SHOW_STARTER_QUESTION` | `message`, `options` | `components/Chatbot/hooks/useHelloEffects.ts` | Starter bubble |
| `HIDE_STARTER_QUESTION` | none | `components/Chatbot/hooks/useHelloIntegration.ts` | Hides it |
| `ENABLE_DOMAIN_TRACKING` | none | `components/Chatbot/hooks/useHelloEffects.ts` | `enableDomainTracking` (patches `history`) |
| `PUSH_NOTIFICATION` | `message_type`, `content`, `horizontal_position`, `vertical_position` | `hooks/notifications/notificationSocketEventHandler.tsx` | `handlePushNotification` |
| `LAUNCHER_MESSAGE_PREVIEW` | `content`, `notificationId`, `ttl` | `hooks/notifications/notificationSocketEventHandler.tsx` | Preview bubble above the launcher |
| `setDataInLocal` | `key`, `payload` | `utils/utilities.js:setLocalStorage`, `components/Chatbot/hooks/useHelloEffects.ts` | Writes host-origin `localStorage` |
| `downloadAttachment` | `url` | `components/Interface-Chatbot/Messages/ImageWithFallback.tsx` | Downloads on the host page |
| `RELOAD_PARENT` | none | `hooks/CORE/eventHandlers/localStorage/localStorageEventsHandler.ts` | `window.location.reload()` |

With `isMobileSDK`, the host side forwards a subset to the native wrapper as stringified `window.postMessage`; see [embed-script](modules/embed-script.md#mobile-sdk-channel).

**Adding an event:** a new host → iframe type needs `addEventHandler` in the HELLO handler file and the sender in all three `public/chat-widget*.js`. A new iframe → host type needs a `ParentEventType` member and a `case` in `handleIncomingMessages` in all three scripts. Then add the row here.

## Outbound backend calls

Every REST call is in `config/helloApi.ts`, through the axios instance in `utils/helloInterceptor.ts`. Base URL is `config/regionConfig.ts:getHelloHostUrl` (region from `routing-region`, else `NEXT_PUBLIC_MSG91_HOST_URL`), except the push call. Auth is an `authorization` header, no bearer prefix: `W` = `WidgetId`, `W:C` = `WidgetId:<k_clientId or a_clientId>` from `getAuthorization`, `W[:C]` = client id only when one exists. Bodies, response shapes and the identity model: [hello-api](integrations/hello-api.md#calls-we-make).

| Function | Method + path | Auth |
|---|---|---|
| `getRoutingRegion` | `POST /routing-region/` | `W` |
| `initializeHelloChat` | `POST /widget-info/` | `W` |
| `registerAnonymousUser` | `POST /anonymous-client-details/` | `W` |
| `getAllChannels` | `POST /pubnub-channels/list/` | `W[:C]` |
| `getJwtToken` | `GET /jwt-token/` | `W:C` |
| `getAgentTeamApi` | `POST /agent-team/` | `W:C` |
| `getGreetingQuestions` | `POST /chat-bot/welcome/get-welcome/` (lex bots) or `GET /chat-gpt/greeting/` | `W[:C]` |
| `saveClientDetails` | `PUT /v2/client/<clientId>` | `W:C` |
| `getHelloChatHistoryApi` | `POST /get-history/` | `W:C` |
| `getFullMessageApi` | `POST /get-history/` (with `message_id`) | `W:C` |
| `sendMessageToHelloApi` | `POST /v2/send/` | `W:C` |
| `uploadAttachmentToHello` | `POST /v2/upload/?type=chat&inbox_id=<id>` | `W:C` |
| `getClientToken` | `GET /web-rtc/get-client-token/` | `W:C` |
| `getCallToken` | `GET /web-rtc/get-call-token/?channel=<id>` (no caller today) | `W:C` |
| `addDomainToHello` | `PUT /add-domain/` | `W:C` |
| `deleteReadReceipt` | `DELETE /read-receipt/<channelId>` | `W:C` |
| `submitFeedback` | `POST /receive-feedback/` | `W:C` |
| `subscribeForFCMPushNotification` | `POST <NEXT_PUBLIC_PUSH_NOTIFICATION_URL>/add-user-fcm-token/` | socket JWT |

> [!WARNING]
> Call `getRoutingRegion` before any other Hello endpoint and never cache `getHelloHostUrl()` in a constant; every company is pinned to one regional backend. See [hello-api](integrations/hello-api.md#region-routing).

Other outbound connections, documented elsewhere: the chat socket (`hooks/socketManager.js`, URL from `getSocketUrl`) and notification socket (`hooks/notifications/notificationSocketManager.ts`) in [realtime](modules/realtime.md); WebRTC via `msg91-webrtc-call` in [voice-calling](modules/voice-calling.md); A/B events to `NEXT_PUBLIC_MW_EVENTS_URL` from `utils/middlewareExperiments.ts:mwSend` (no caller yet).
