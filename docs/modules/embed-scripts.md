---
covers: ["public/chat-widget*.js", "public/chatbot*.js", "public/urlMonitor.js", "hooks/CORE/**", "hooks/HELLO/eventHandlers/embeddingScript/**", "hooks/GTWY/eventHandlers/embeddingScript/**", "utils/emitEventsToParent/**"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Embed scripts and the host ↔ iframe bridge

Host websites load one plain-JS file from `public/`. It draws a launcher button on the host page, creates an iframe pointing at this Next app's `/chatbot` route, exposes a JS API on `window`, and talks to the iframe with `postMessage`. Inside the iframe, `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:useEmbeddingScriptEventHandler` receives those messages and dispatches them to Redux. There are two products with two unrelated scripts:

- **MSG91 Hello chat widget** (human agents, tickets): `public/chat-widget.js` family. Class `HelloChatbotEmbedManager`, API `window.chatWidget` / `window.initChatWidget`.
- **GTWY AI chatbot** ("interface"/"bridge"): `public/chatbot.js` family. Class `ChatbotEmbedManager`, API `window.Chatbot` / `window.SendDataToChatbot`.

| File | Role |
|---|---|
| `public/chat-widget.js` | Hello loader, **production**. Default subdomain `blacksea`. All URLs derived from the script's own origin. |
| `public/chat-widget-dev.js` | Hello loader, **dev**. Default subdomain `ctest`. Forwards `?env=stage` to the iframe. |
| `public/chat-widget-local.js` | Hello loader, **local**. Default subdomain `3001`; iframe/CSS/urlMonitor URLs hardcoded to `http://localhost:<subdomain>`. |
| `public/chat-widget-style.css` | Host-page CSS for the Hello launcher, iframe container, badge, starter question, push-notification modal, launcher preview. Loaded from `<scriptOrigin>/chat-widget-style.css`. |
| `public/chatbot.js` | GTWY loader, "prod" (see the localhost warning below). |
| `public/chatbot-dev.js` | GTWY loader, dev (`dev-chatbot.gtwy.ai`, `dev-db.gtwy.ai`). |
| `public/chatbot-local.js` | GTWY loader, local (`localhost:3000`, login URL commented out). |
| `public/chatbot-style.css` | Host-page CSS for the GTWY launcher and container. |
| `public/urlMonitor.js` | Optional Hello add-on: opens matching links in a slide-in iframe panel on the host page. Injected by `public/chat-widget*.js` only when `previewLinks` is passed. |
| `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Iframe side. `EmbeddingScrpitEventRegistry` (sic) maps message `type` → handler; one `window` `message` listener dispatches. |
| `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Registers the Hello message types (`helloData`, `CHATBOT_OPEN`, `SHOW_TICKET`, ...). |
| `hooks/GTWY/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Registers the GTWY `interfaceData` handler. |
| `hooks/CORE/eventHandlers/localStorage/localStorageEventsHandler.ts` | Iframe side. Listens to the custom `localstorage-updated` event and the `storage` event; on a full localStorage clear it resets Redux and posts `RELOAD_PARENT` to the host. |
| `hooks/HELLO/eventHandlers/localStorage/localStorageEventsHandler.ts` | Syncs `k_clientId` / `a_clientId` writes into the Hello Redux slice. |
| `utils/emitEventsToParent/emitEventsToParent.tsx` | `emitEventToParent(type, data)` — the typed iframe → host sender. `ParentEventType` lists the allowed types. |

Both hook registries are mounted once in `components/Chatbot-Wrapper/ChatbotWrapper.tsx` (`ChatbotWithHooks`), which also posts `interfaceLoaded` to the host on mount. Related docs: [widget boot flow](../flows/widget-boot.md), [app shell](app-shell.md), [Hello integration](../integrations/hello.md), [AI message flow](../flows/ai-message.md), full host API and message table in [api.md](../api.md).

## How it works

### Hello widget (`public/chat-widget*.js`)

1. **Find itself.** `document.currentScript`, else the first `script[src*="chat-widget"]`. `subdomain` = first hostname label (`blacksea.<domain>` → `blacksea`), or the **port** when the host is `localhost`. `scriptOrigin` = the script URL's origin.
2. **Namespace by subdomain.** One `HelloChatbotEmbedManager(subdomain)` per loaded script. DOM ids are prefixed `${subdomain}-hello-` (e.g. `ctest-hello-chatbot-iframe-component`), except legacy subdomains (`isLegacySubdomain`: `blacksea`, `ctest`, and in `-local` also `3001`) which use the bare `hello-` prefix. This is what lets two widgets (different subdomains) live on one page (commit 60a41de "Support of multiple widget on a single Page").
3. **Constructor** wires listeners immediately: a `MutationObserver` on `<head>` that calls `cleanupChatbot` when a `<script>` whose `src` contains `chat-widget` is removed; the `message` listener; a `ResizeObserver` on `<html>`.
4. **`loadContent`** (on `DOMContentLoaded` or immediately if `body` exists): appends the launcher (`createChatbotIcon`, hidden), the stylesheet `<link>`, the hidden iframe container (`createIframeContainer`), then `processChatbotDetails` sets the iframe `src`:
   ```text
   <scriptOrigin>/chatbot?interfaceDetails=<encodeURIComponent(JSON.stringify({ isHelloUser: true }))>
   (-dev and -local also append &env=stage when the HOST page URL has ?env=stage)
   ```
   No widget token is in the URL. The token arrives later via the `helloData` message. `app/chatbot/layout.tsx` parses `interfaceDetails` (and `env`, only the value `stage`).
5. **Iframe attributes:** `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation"`, `allow="microphone *; camera *; midi *; encrypted-media *; clipboard-write *; clipboard-read *"` (mic/camera are needed for Hello voice/video calls).
6. **Host calls `initChatWidget(data, delay)`** → `subdomainInitFunction`: stores `data` as `manager.helloProps`, loads `urlMonitor.js` if `previewLinks`, forwards `variables` as `SET_VARIABLES_FOR_BOT`, moves the container into `parentId` if given, then after `delay` ms sets `delayElapsed`.
7. **Handshake.** The launcher is shown and `helloData` is sent only when both `interfaceLoaded` (posted by the iframe) and `delayElapsed` are true (`showIconIfReady` → `sendInitialData`). If `initChatWidget` is never called, `helloProps` stays `null` and `helloData` is never sent, so the iframe never learns the widget token.
8. Iframe boots Hello (`components/Chatbot/hooks/useHelloEffects.ts`) and drives the host UI back with `hide_widget`, `launch_widget`, `SHOW_STARTER_QUESTION`, `SET_BADGE_COUNT`, `uuid`, `ENABLE_DOMAIN_TRACKING`, etc.

### GTWY chatbot (`public/chatbot*.js`)

1. Reads props from the `<script id="chatbot-main-script">` attributes (`extractScriptProps`): `interfaceId, embedToken, threadId, bridgeName, variables, onOpen, onClose, iconColor, className, style, environment, fullScreen, hideCloseButton, hideIcon, parentId, config, headerButtons, eventsToSubscribe, modalConfig, allowModalSwitch, chatTitle, chatIcon, hideFullScreenButton, defaultOpen`. `config`, `headerButtons`, `eventsToSubscribe`, `modalConfig` are JSON-parsed. All go into `state.tempDataToSend`.
2. `fetchChatbotDetails` → `POST <urls.login>` (`https://db.gtwy.ai/chatbot/loginuser` in `chatbot.js`). With `embedToken`: header `Authorization: <embedToken>`. Without: body `{ isAnonymousUser: true, interface_id }` read from the `interface_id` attribute.
3. `processChatbotDetails(response)` sets iframe `src` to `<urls.chatbotUrl>?interfaceDetails=<encodeURIComponent(JSON.stringify(response.data))>` and merges `response.data.config` into the size config. `app/chatbot/layout.tsx` reads `chatbot_id`, `userId`, `token`, `config` from it.
4. On `interfaceLoaded` the script posts `interfaceData` with the accumulated `tempDataToSend` (then clears it) and opens if `defaultOpen` is true. The iframe's `handleInterfaceData` dispatches `threadId`, `bridgeName`, `variables`, `helloId`, `version_id`, `headerButtons`, `eventsToSubscribe` (filtered by `ALLOWED_EVENTS_TO_SUBSCRIBE`), `modalConfig`, `chatTitle`/`chatIcon`/... into `appInfo` and `interface` slices.
5. Fixed, un-prefixed ids: `interfaceEmbed`, `popup-interfaceEmbed`, `iframe-parent-container`, `iframe-component-interfaceEmbed`, `chatbotEmbed-style`. If an element `#interface-chatbot` exists it hosts the container. **Only one GTWY widget per page.**

### urlMonitor (`public/urlMonitor.js`)

Loaded by `HelloChatbotEmbedManager.addUrlMonitor` when `initChatWidget` gets `previewLinks: string[]`. It sets `window.chatWidget.initUrlTracker({ urls })` and, once, patches `window.open`, `history.pushState`, `history.replaceState`, and adds capture-phase `click` (anchors, `[data-url]`, URLs parsed out of `onclick` source) and GET-form `submit` listeners. `shouldPrevent` matches the target against patterns (full URL with `*`, `/path/*`, substring with `*`, or exact path) and opens it in a fixed right-side panel (`#url-monitor-panel`, "Close" / "New tab") instead of navigating — unless the current page is already in the same section, or the page is itself inside an iframe. Guarded by `window.__urlMonitorInitialized__`.

### Sizing, open/close, unread (Hello)

- Default config: `{ type: 'popup', height: 'min(724px, calc(100% - 40px))', width: '440', widthUnit: 'px' }`. A height containing `(` is used verbatim. Container is `position: fixed; bottom/right: 10px` unless `parentId` names an existing element, in which case it fills that element (`changeContainer`).
- `ResizeObserver`: host width `< 600` (or `isMobileSDK`) → container 100% × 100% with class `hello-full-screen-interfaceEmbed`; otherwise `applyConfig` restores the config size. Skipped while fullscreen.
- `state.chatbotSize`: `NORMAL` | `MINIMIZED`. `MINIMIZE_CHATBOT` shrinks to a 60px bar (or closes on width `< 600`). `ENTER_/EXIT_FULL_SCREEN_CHATBOT` toggle 100% size.
- `openChatbot(id)` hides the launcher and preview, animates the container in, posts `open` to the iframe **and** to `window.parent` (for when the host page is itself framed), then posts `CHATBOT_OPEN {id}`; a non-empty `id` makes the iframe open that ticket. `closeChatbot` posts `close` to `window.parent` and `CHATBOT_CLOSE` to the iframe; in `isMobileSDK` mode it only notifies the native side.
- Launcher visibility: shown only when `helloProps.hide_launcher` is explicitly `false`/`'false'`. Values passed by the host (`hide_launcher`, `launch_widget`) win over the server's `hide_widget` / `launch_widget` messages (the handler ignores the message when the key is `in helloProps`).
- Unread: iframe posts `SET_BADGE_COUNT { badgeCount, channelId }`. `channelId: '*'` updates the launcher badge; any channel id also updates an element with id `unread-<channelId>` if the host page has one. `getTicketUnreadCount(id)` returns a Promise resolved by `TICKET_UNREAD_COUNT { id, count }`, or `0` after 5 s.

## Contracts

### Host API — Hello (`public/chat-widget*.js`)

`window.chatWidget[<subdomain>]` holds the methods below. For legacy subdomains they are also copied flat onto `window.chatWidget`. `window.initChatWidget(data, delay)` always routes to the **last loaded** script's subdomain. Prod also sets `window[<subdomain>_helloChatbotManager]` (not in `-local`).

| Method | Effect |
|---|---|
| `initChatWidget(data, delay = 0)` | Boot config (see shape below). Blocked after `initializeHelloChat_failed`. |
| `SendDataToBot(data)` | If `variables` in data → `SET_VARIABLES_FOR_BOT` only. Else moves container on `parentId`, applies `hide_launcher`/`launch_widget`/`starter_question`/`config`, posts `helloRunTimeData` (+ `askAi` if `data.askAi`). |
| `addCustomData(d)` / `modifyCustomData(d)` | `UPDATE_USER_DATA_SEGMENTO` → iframe saves client details (`name`/`mail`/`number` renamed to `Name`/`Email`/`Phonenumber`). |
| `addUserEvent(d)` | `ADD_USER_EVENT_SEGMENTO`. |
| `open(id?)`, `close()`, `toggleWidget()` | Open/close the panel; `id` = ticket/channel to open. |
| `openWithMessage(message, autoSend = true, alwaysNewChat = true)` | Opens, then `SEND_INITIAL_MESSAGE`. `autoSend=false` only prefills the input. |
| `hide()` / `show()` | Hide launcher + panel / show launcher. |
| `showTicket(id)` | `SHOW_TICKET`. |
| `getTicketUnreadCount(id)` | Promise<number>; `id='*'` sums all channels. |
| `handlePushNotification(data)` | Render a push-notification modal on the host. |
| `shutdown()` | `SHUTDOWN_CHATBOT` → iframe clears `k_clientId`/`a_clientId` and the `<widgetToken>_..._clientId` keys (logout). |
| `initUrlTracker({ urls })` | Added by `urlMonitor.js`. |

```ts
// initChatWidget / helloData payload (keys read in this repo; all optional except widgetToken)
{
  widgetToken: string,            // Hello widget token; sessionStorage key becomes `${widgetToken}_${unique_id}` when unique_id is set
  unique_id?, mail?, number?, name?, user_jwt_token?,   // identified user; user_jwt_token kept only if unique_id|mail|number
  hide_launcher?: boolean|'true'|'false', launch_widget?: boolean|'true'|'false',
  parentId?: string,              // id of a host element to render inside
  icon_position?: 'left'|'right', icon_bottom_margin?: number|string,
  variables?: object,             // -> SET_VARIABLES_FOR_BOT
  previewLinks?: string[],        // -> loads urlMonitor.js
  theme?: 'light'|'dark'|'system', sdkConfig?: { customTheme?, theme? },
  isMobileSDK?: boolean, pushConfig?: object, hideFullScreenButton?: boolean,
  config?: { type, height, heightUnit, width, widthUnit, buttonName, iconUrl }
}
```

### Host API — GTWY (`public/chatbot*.js`)

`window.Chatbot = { open, close, show, hide, reloadChats, askAi(data), sendData(data) }`, plus globals `window.openChatbot`, `window.closeChatbot`, `window.reloadChats`, `window.askAi`, `window.SendDataToChatbot(data)`. `SendDataToChatbot` accepts an object or JSON string, handles `parentId`, `hideCloseButton`, `hideIcon`, `iconColor`, `fullScreen`, `config`, and posts `interfaceData` (+ `askAi`). If `window.ReactNativeWebView` exists, open/close/data are mirrored to it as JSON strings.

### postMessage protocol

Envelope is always `{ type, data }` (GTWY `refresh` uses `{ type: 'refresh', reload: true }`). Host → iframe messages are sent with target origin `'*'` to `iframe.contentWindow`. Iframe → host uses `window.parent.postMessage(msg, '*')`, mostly via `emitEventToParent`.

Host → iframe

| type | Sent by | Payload | Handled in iframe by |
|---|---|---|---|
| `helloData` | Hello `sendInitialData` | full `helloProps` | HELLO `handleHelloData` |
| `helloRunTimeData` | Hello `processDataProperties` | `themeColor`, `tagline`, `show_widget_form`, `variables`, `fullScreen` | HELLO `handleHelloRuntimeData` |
| `SET_VARIABLES_FOR_BOT` | Hello init / `SendDataToBot` | `{ variables, ... , name }` (prod adds `name`) | HELLO `handleSetVariablesForBot` |
| `CHATBOT_OPEN` / `CHATBOT_CLOSE` | Hello open/close | `{ id? }` | HELLO `handleChatbotVisibility` |
| `open` | both | `{}` | `components/Interface-Chatbot/ChatbotTextField.tsx` focuses input |
| `SEND_INITIAL_MESSAGE` | `openWithMessage` | `{ message, autoSend, alwaysNewChat }` | HELLO `handleSendInitialMessage` |
| `STARTER_QUESTION_OPTION_CLICKED` | starter bubble | `{ option }` | HELLO, sends option as a message |
| `SHOW_TICKET`, `GET_TICKET_UNREAD_COUNT`, `SHUTDOWN_CHATBOT` | API methods | `{ id }` / – | HELLO |
| `UPDATE_USER_DATA_SEGMENTO`, `ADD_USER_EVENT_SEGMENTO` | API methods | user object | HELLO → `config/helloApi.ts` |
| `parent-route-changed` | `enableDomainTracking` | `{ websiteUrl }` | HELLO → `addDomainToHello` |
| `ADD_COBROWSE_SCRIPT` | `CobrowseManager` after CobrowseIO starts | `{ origin }` | HELLO → `hooks/coBrowser/CBManger.ts` |
| `OPEN_WITH_NOTIFICATION` | launcher preview click | `{ content, notificationId }` | HELLO `handleOpenWithNotification` |
| `askAi` | both (`data.askAi`) | string or object | `components/Chatbot/hooks/useChatEffects.ts` (GTWY only, `!isHelloUser`) |
| `interfaceData` | GTWY | script props | GTWY `handleInterfaceData` |
| `refresh` | GTWY `reloadChats` | `reload: true` | `useChatEffects.ts` |

Iframe → host (Hello script handles all; GTWY script handles only `CLOSE_CHATBOT`, `ENTER_/EXIT_FULL_SCREEN_CHATBOT`, `interfaceLoaded`)

| type | Emitted from | Host effect |
|---|---|---|
| `interfaceLoaded` | `ChatbotWrapper.tsx` mount | Hello: show launcher + send `helloData`; GTWY: send `interfaceData` |
| `CLOSE_CHATBOT`, `OPEN_CHATBOT`, `MINIMIZE_CHATBOT`, `ENTER_FULL_SCREEN_CHATBOT`, `EXIT_FULL_SCREEN_CHATBOT` | header, drawer, `app/error.tsx`, voice service | resize/open/close |
| `initializeHelloChat_failed` | `useHelloEffects.ts` | sets `block_chatbot`, removes widget DOM |
| `hide_widget`, `launch_widget` | `useHelloEffects.ts` (from widget-info) | show/hide launcher, auto-open |
| `setDataInLocal` `{ key, payload }` | `utils/utilities.js`, `useHelloEffects.ts` | writes **host** localStorage (`hello-widget-uuid`, `hello-widget-anonymoud-uuid`, `widgetInfo`) |
| `uuid` `{ uuid }` | `useHelloEffects.ts` | starts CobrowseIO on host with that device id |
| `ENABLE_DOMAIN_TRACKING` | `useHelloEffects.ts` | patches host `history` and reports URLs via `parent-route-changed` |
| `SET_BADGE_COUNT`, `TICKET_UNREAD_COUNT` | `useHelloEffects.ts`, `store/hello/helloReducer.ts`, HELLO handler | badge / resolve promise |
| `SHOW_STARTER_QUESTION` `{ message, options }`, `HIDE_STARTER_QUESTION` | `useHelloEffects.ts`, `useHelloIntegration.ts` | starter bubble |
| `PUSH_NOTIFICATION`, `LAUNCHER_MESSAGE_PREVIEW` | `hooks/notifications/notificationSocketEventHandler.tsx` | modal / preview bubble (`ttl` seconds, max 30) |
| `downloadAttachment` `{ url }` | `ImageWithFallback.tsx` | host fetches blob and downloads |
| `RELOAD_PARENT` | CORE localStorage handler | `window.location.reload()` |
| `FRONT_END_ACTION`, `HEADER_BUTTON_PRESS`, `MESSAGE_CLICK`, `BRIDGE_SWITCH` | `utils/ChatbotUtility.ts`, `ChatbotHeader.tsx`, `UserMessage.tsx` | not handled by either script; meant for the host's own `message` listener |

**Origin checks.** Hello host side accepts a message only if `event.origin` is `scriptOrigin` or the host's own origin **and** `event.source` is its own iframe's `contentWindow` (this is what separates two widgets on one page). GTWY host side checks origin against a hardcoded list only (`http://localhost:3000`, the GTWY chatbot domain, host origin), no source check. The iframe side (`useEmbeddingScriptEventHandler`, `useChatEffects`, `ChatbotTextField`) does **no origin check**: any window that can reach the iframe can post `helloData`, `SHUTDOWN_CHATBOT`, etc.

### Env variant drift (as of b9ab6d6)

| Difference | prod | -dev | -local |
|---|---|---|---|
| Hello default subdomain (only used if detection fails) | `blacksea` | `ctest` | `3001` |
| Hello iframe/CSS/urlMonitor base | `scriptOrigin` | `scriptOrigin` | `http://localhost:<subdomain>` |
| Hello forwards `?env=stage` | no | yes | yes |
| Hello `SET_VARIABLES_FOR_BOT` adds `name` | yes | no | no |
| Hello `state.unreadCountResolver` initialised | yes | no (created lazily, works) | no |
| Hello `window[<sub>_helloChatbotManager]` | yes | yes | no |
| Hello trusted-origin + source check | yes | yes | yes |
| Hello popup push-notif sizing | `getHTMLDimensions` + 500 ms poll, Esc closes | same as prod, plus custom modal `zIndex 9999` | older measuring code, no Esc on popup, has `zIndex 9999` |
| GTWY iframe URL | `http://localhost:3001/chatbot` (!) | `https://dev-chatbot.gtwy.ai/chatbot` | `http://localhost:3000/chatbot` |
| GTWY login URL | `https://db.gtwy.ai/chatbot/loginuser` | `https://dev-db.gtwy.ai/chatbot/loginuser` | commented out (undefined) |

## Gotchas

> [!WARNING]
> **Three copies per script, edited by hand.** Any behaviour change to `public/chat-widget.js` must be made in `public/chat-widget-dev.js` and `public/chat-widget-local.js` too (same for `public/chatbot*.js`). The table above shows they already drifted. Run `diff public/chat-widget.js public/chat-widget-dev.js` before and after; the only intended differences are the default subdomain, URL base and `env=stage` forwarding.

> [!WARNING]
> `public/chatbot.js` (the non-suffixed GTWY "prod" file) loads its iframe from `http://localhost:3001/chatbot` since commit 00039fe, while its stylesheet and login URL point at production. A host using this file gets a broken iframe. Do not "fix" it blindly. [!TODO] Needs a human: which GTWY script URL is actually served to customers in production, and is `public/chatbot.js` still used?

> [!WARNING]
> The Hello message types are an API shared with the host page and with any customer code listening to `message`. Renaming a type in `emitEventToParent` or in a HELLO handler without updating all three `public/chat-widget*.js` files breaks live sites silently: unknown types fall into `default:` and are dropped, and the iframe registry ignores types it has not registered.

> [!WARNING]
> `helloData` is only sent after **both** `interfaceLoaded` and the `initChatWidget` delay. Calling `SendDataToBot` before `initChatWidget` does not boot the widget. `initChatWidget` on a page with two widgets must be called as `window.chatWidget.<subdomain>.initChatWidget`, because `window.initChatWidget` is overwritten by whichever script ran last.

> [!WARNING]
> Script detection: for `async`/`defer` loads `document.currentScript` is `null` and the fallback picks the **first** `script[src*="chat-widget"]` on the page, so two async widget scripts both resolve to the first one's subdomain. The comment mentioning a `data-widget-id` attribute describes code that does not exist.

> [!WARNING]
> `setPropValues` in both script families references `AI_WHITE_ICON` / `AI_BLACK_ICON`, which are never defined, and the Hello element `popupInterfaceEmbed` is never created. Passing `iconColor` throws a `ReferenceError`/`TypeError` inside `updateProps`.

> [!WARNING]
> GTWY anonymous login reads the attribute `interface_id`, but `extractScriptProps` lists `interfaceId` (HTML lowercases attribute names, so it reads `interfaceid`). Host pages must set `interface_id` on `<script id="chatbot-main-script">` for anonymous mode.

> [!WARNING]
> `cleanupChatbot` resets `window.__HELLO_WIDGET_LOADED__`, but the guard that set it was removed in 60a41de; reloading the script does not dedupe. Each load adds another `message` listener and observers.

> [!WARNING]
> In `isMobileSDK` mode the Hello script sends to native code with `window.postMessage(JSON.stringify(msg))` on the **host window itself** (a WebView bridge hook), and `closeChatbot` returns early without hiding the container.

## Why it is built this way

- **Subdomain namespacing** (60a41de, refined in b81a152): one page may embed widgets from two Hello environments/tenants; ids, `window.chatWidget[subdomain]` and the `event.source` check keep them apart. `blacksea` and `ctest` keep un-prefixed ids and flat `window.chatWidget.*` methods for backward compatibility with existing customer embeds.
- **URLs derived from `scriptOrigin`** (prod/dev Hello): the same file works on any deployment host; only the local variant hardcodes localhost. GTWY scripts predate this and still hardcode URLs.
- **Token sent by postMessage, not in the iframe URL**: the Hello iframe URL only carries `isHelloUser: true`; identity (`widgetToken`, `user_jwt_token`) goes through `helloData`, and the iframe persists a per-token session (`SetSessionStorage('widgetToken', ...)`, `${widgetToken}_persist:Chat`).
- **`env=stage` forwarding** (0c49096 "staging url handling", 1b52a96): lets the dev script hit stage Hello APIs; `config/regionConfig.ts` reads it inside the iframe.
- A redirect-URL feature touching all variants was merged and reverted (9525b9e, PR #344). [!TODO] Needs a human: why was PR #344 reverted, and is it planned again?
- [!TODO] Needs a human: why are there three hand-maintained copies instead of one file built per environment?

## Changing it safely

1. Edit `public/chat-widget.js`, then apply the same hunk to `-dev` and `-local` (and the CSS in `public/chat-widget-style.css` if ids/classes change). For GTWY, all three `public/chatbot*.js`.
2. New host → iframe message: add a `case`/sender in the script, register it with `eventHandler.addEventHandler('<TYPE>', ...)` in the HELLO or GTWY hook. Unregistered types are ignored by the iframe.
3. New iframe → host message: add the type to `ParentEventType` in `utils/emitEventsToParent/emitEventsToParent.tsx`, emit with `emitEventToParent`, and add a `case` in `handleIncomingMessages` in all three Hello files.
4. New `initChatWidget` key that must not be saved as a Hello client field: add it to `keysToRemove` in `components/Chatbot/hooks/useHelloEffects.ts`, otherwise it is sent to `saveClientDetails`.
5. Keep the API and message tables in [api.md](../api.md) in sync.
6. Test with a static HTML page that loads `http://localhost:<port>/chat-widget-local.js` (port = Next dev port; it becomes the subdomain), call `initChatWidget({ widgetToken })`, and check: launcher appears, open/close, fullscreen, minimize, badge, and that a second widget script from another origin does not react to the first iframe's messages.
