---
covers: ["public/chat-widget.js", "public/chat-widget-dev.js", "public/chat-widget-local.js", "public/chat-widget-style.css", "public/urlMonitor.js"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Embed script

The plain-JS script a customer pastes on their own website. It draws the launcher button, creates an iframe that loads this Next.js app at `/chatbot`, exposes `window.initChatWidget` and `window.chatWidget.*`, and relays `postMessage` events between the host page and the iframe. Nothing in the Next.js app imports these files; they are served as static assets from `public/`.

| File | Role |
|---|---|
| `public/chat-widget.js` | Production embed script (IIFE). Launcher, iframe, window API, message relay, push-notification and launcher-preview popups, co-browse loader, domain tracking. |
| `public/chat-widget-dev.js` | Near-copy of the production script with a stage-backend switch (see [Prod, dev and local copies](#prod-dev-and-local-copies)). |
| `public/chat-widget-local.js` | Older near-copy that points the iframe at `http://localhost:<port>`. Has drifted from the other two. |
| `public/chat-widget-style.css` | Styles for launcher, iframe container, starter question, notification popups, badge and launcher preview. Loaded by the script into the host page `<head>`. |
| `public/urlMonitor.js` | Optional "preview links" side panel: intercepts navigation on the host page to configured URLs and opens them in a slide-in iframe. Loaded on demand. |

The iframe side of every event below is handled in the app shell (`hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`, `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`, `utils/emitEventsToParent/emitEventsToParent.tsx`); see [app shell](app-shell.md). The public contract is summarized for integrators in [api](../api.md); the end-to-end boot is in [widget boot flow](../flows/widget-boot.md).

## How it works

Everything runs inside one IIFE in `public/chat-widget.js`.

1. **Find itself.** It reads `document.currentScript`, or falls back to the first `script[src*="chat-widget"]` (async/defer loads have no `currentScript`). No script `src` means it logs `[Hello Widget] Error` and stops.
2. **Derive the subdomain.** `subdomain` is the first DNS label of the script host (`blacksea` for `blacksea.<domain>`), or the port when the host is `localhost`. `scriptOrigin` is the script's origin. Everything that must be unique per widget is keyed on `subdomain`.
3. **Build the manager.** `new HelloChatbotEmbedManager(subdomain)` sets element ids with a prefix: `hello-` for the legacy subdomains (`isLegacySubdomain`: `blacksea`, `ctest`), otherwise `<subdomain>-hello-`. The constructor also sets URLs (`chatbotUrl` = `<scriptOrigin>/chatbot`, the stylesheet and `urlMonitor.js` from the same origin), default `config` (popup, 440px wide, `min(724px, calc(100% - 40px))` high) and starts three listeners: a `MutationObserver` on `<head>` (removing the script tag calls `cleanupChatbot`), the `message` listener, and a `ResizeObserver` on `<html>` (below 600px the container goes full screen via `hello-full-screen-interfaceEmbed`).
4. **Expose the API.** `window.chatWidget[subdomain] = windowMethods`; for legacy subdomains the same methods are also copied flat onto `window.chatWidget`. `window.initChatWidget` forwards to `window.chatWidget[subdomain].initChatWidget`. Production and dev also store the manager on `window[<subdomain>_helloChatbotManager]`.
5. **Render.** `initializeChatbot` → `loadContent` (on `DOMContentLoaded`, or at once if `<body>` exists): append the hidden launcher, the `<link>` to the stylesheet, the hidden iframe container, then `processChatbotDetails` sets the iframe `src` to `<scriptOrigin>/chatbot?interfaceDetails=<{"isHelloUser":true}>` and applies the default config. The container goes into `helloProps.parentId` if that element exists, else into `<body>` as a fixed popup (`changeContainer`).
6. **Wait for two signals.** The launcher appears and the iframe gets its config only when both are true (`showIconIfReady`):
   - `state.interfaceLoaded`: the iframe posted `interfaceLoaded` (from `components/Chatbot-Wrapper/ChatbotWrapper.tsx`).
   - `state.delayElapsed`: the host called `initChatWidget(data, delay)` and `delay` ms passed.
   Then it applies `icon_position` and `icon_bottom_margin`, opens the widget if `launch_widget` is set, and `sendInitialData` posts `helloData` (the whole `helloProps`) plus `CHATBOT_OPEN` if the container is already visible.
7. **Relay.** From then on `handleIncomingMessages` reacts to iframe events, and window methods post events into the iframe through `sendMessageToChatbot`.

Open/close: `openChatbot` hides the launcher, shows the container with a scale-in animation, posts `{type:'open'}` to `window.parent` and to the iframe, then `CHATBOT_OPEN`. `closeChatbot` hides the container, re-shows the launcher unless a hide flag is set, posts `{type:'close'}` to `window.parent` and `CHATBOT_CLOSE` to the iframe. With `isMobileSDK`, close only notifies the native wrapper and returns.

## Contracts

### Window API and postMessage events

The method list, the `initChatWidget` config keys and both postMessage tables (host → iframe, iframe → host) live in [api](../api.md#host-page-js-api). This section only adds what the embed script does internally.

- `windowMethods` in `public/chat-widget.js` is the source of truth. Methods are reached as `window.chatWidget.<subdomain>.<name>(...)`, or flat on `window.chatWidget` for legacy subdomains.
- `initChatWidget` also loads `urlMonitor.js` when `previewLinks` is set and moves the container when `parentId` is set; it is a no-op once `initializeHelloChat_failed` was received.
- `SendDataToBot` accepts an object or a JSON string. Without `variables` it moves the container if `parentId` changed, then runs `processDataProperties` (UI keys, starter question, `config`).
- Every outbound message goes through `sendMessageToChatbot` with target `'*'`.
- Inbound messages are handled in `handleIncomingMessages` and accepted only if `event.origin` is `scriptOrigin` or the page's own origin **and** `event.source` is this widget's own iframe.
- Host-side effects not obvious from the event name: `initializeHelloChat_failed` sets `block_chatbot` and removes all widget DOM; `MINIMIZE_CHATBOT` closes instead of minimizing below 600px width; `LAUNCHER_MESSAGE_PREVIEW` auto-hides after `ttl` seconds (default 10, max 30); `setDataInLocal` writes to the host origin's `localStorage`; `SET_BADGE_COUNT` also updates any host element with id `unread-<channelId>`.

### Mobile SDK channel

When `helloProps.isMobileSDK` is set, `sendDataToMobileSDK` calls `window.postMessage(JSON.stringify(msg))` on the host window (the native WebView wrapper listens there). Types: `open`, `close`, `data` (from `SendDataToBot`), `uuid`, `PUSH_NOTIFICATION`, `downloadAttachment` (`data` is the URL string).

### DOM ids and CSS

Ids are `<prefix>` + `chatbot-launcher-icon`, `chatbot-icon-image`, `chatbot-icon-text`, `chatbot-iframe-container`, `chatbot-iframe-component`, `chatbot-style`, `unread-msg-count-badge`, `starter-question-container`, `launcher-msg-preview`. The stylesheet matches them by suffix (`[id$="hello-chatbot-launcher-icon"]`), so both prefixes work. Layout variants are classes named `<config.type>-parent-container` / `<config.type>-interfaceEmbed` (`popup`, `pop_over`, `all_available_space`, `left_slider`, `right_slider`). The popup container uses `z-index: 2147483647`.

## Prod, dev and local copies

`diff public/chat-widget.js public/chat-widget-dev.js` at this commit:

| Difference | `chat-widget.js` | `chat-widget-dev.js` | `chat-widget-local.js` |
|---|---|---|---|
| Iframe / CSS / urlMonitor base | `scriptOrigin` | `scriptOrigin` | `http://localhost:<subdomain>` (subdomain is the port) |
| Legacy subdomains | `blacksea`, `ctest` | `blacksea`, `ctest` | adds `3001` |
| Constructor default subdomain (unused: always passed) | `blacksea` | `ctest` | `3001` |
| Host `?env=stage` copied to iframe URL | no | yes | yes |
| `SET_VARIABLES_FOR_BOT` adds `name` | yes | no | no |
| `window[<subdomain>_helloChatbotManager]` | yes | yes | no |
| Popup push sizing | `getHTMLDimensions` + 500 ms height poll for 10 s, ESC closes | same | older measure-once code, no ESC |
| Custom push `zIndex = '9999'` | no | yes | yes |
| `unreadCountResolver` in initial state | yes | no (set lazily) | no |

`env=stage` makes the app use the stage Hello backend (`config/regionConfig.ts`, `app/chatbot/page.tsx`); see [environment](../environment.md).

> [!WARNING]
> The three scripts are maintained by hand. Every behaviour change must be applied to all three (most commits, e.g. `60a41de`, `0d19257`, `92ee28a`, touch all of them). Keep only the intended differences in the table above. `chat-widget-local.js` already lags behind (popup sizing, ESC handler, manager global), so do not copy it over the others.

> [!TODO] Needs a human: which deployment serves `chat-widget.js` vs `chat-widget-dev.js` (production host vs test host), and should the prod-only `name` key and the dev-only `env=stage` passthrough stay different?

## `urlMonitor.js`

Loaded by `addUrlMonitor` only when `initChatWidget` gets a non-empty `previewLinks`. It appends a hidden right-side panel (`#url-monitor-panel`, z-index 999999) and then intercepts on the host page: `window.open`, `history.pushState`, `history.replaceState`, capturing `click` on `a[href]`, `[data-url]` and inline `onclick` URLs, and GET form `submit`. `shouldPrevent(url)` matches patterns: full URLs (`*` stripped, prefix match), path wildcards like `/faq/*` (same origin), bare substrings with `*`, or exact paths. It never intercepts when the page is itself inside an iframe, or when the current page is already in the matched section. The "New tab" button sets `ignoreNextOpen` so its own `window.open` is not intercepted again. `window.__urlMonitorInitialized__` makes it load once per page.

Despite its name it is not the URL-change reporter; that is `enableDomainTracking` (event `parent-route-changed`).

## Gotchas

> [!WARNING]
> **The launcher stays hidden unless something un-hides it.** `showIconIfReady` shows it only when `helloProps.hide_launcher` is explicitly `false`/`'false'`. If the host omits `hide_launcher`, the server value arrives via `hide_widget` from the iframe. If `initChatWidget` is never called, `delayElapsed` stays false and the iframe never receives `helloData`, so the widget never initializes.

> [!WARNING]
> **Host keys override server keys silently.** If `hide_launcher` or `launch_widget` is present in `helloProps` (even `false`), the iframe's `hide_widget` / `launch_widget` events are ignored.

> [!WARNING]
> **`iconColor` throws.** `setPropValues` reads `AI_WHITE_ICON` / `AI_BLACK_ICON`, which are not defined anywhere, so passing `iconColor` raises a `ReferenceError` inside `updateProps`.

> [!WARNING]
> **One pending unread-count request at a time.** `getTicketUnreadCount` keeps a single resolver in `state.unreadCountResolver`. A second call before the first answers overwrites it; the first promise never resolves.

> [!WARNING]
> **No double-load guard.** The old `window.__HELLO_WIDGET_LOADED__` guard was removed when multi-widget support arrived (`60a41de`); `cleanupChatbot` still resets it but nothing reads it. Loading the same script twice on a page creates two managers with the same element ids. `window.initChatWidget` points at whichever script ran last; with several widgets call `window.chatWidget.<subdomain>.initChatWidget`.

> [!WARNING]
> **Every outbound `postMessage` uses `'*'`.** Payloads such as `helloData` (which carries `user_jwt_token`) are not origin-restricted on the sending side. Inbound messages are checked by origin and by `event.source`.

- `SendDataToBot` reads `previousParentId` after merging the new `parentId` into `helloProps`, so it always equals the new value; the "parent changed" branch never runs and moving relies on `changeContainer` re-appending the node.
- `setDataInLocal` writes any key the iframe sends into the host origin's `localStorage` (keys used: `widgetInfo`, `hello-widget-uuid`, `hello-widget-anonymoud-uuid`).
- `enableDomainTracking` and `urlMonitor.js` both monkey-patch `history.pushState` / `replaceState`. Order of loading decides who wraps whom.
- `CobrowseManager` hard-codes the CobrowseIO license and `http://localhost:3001/chatbot` in `trustedOrigins`.
- Push popups add a `keydown` ESC listener per notification and never remove it.

## Why it is built this way

- **Iframe, not inline React:** isolates the Next.js app and its CSS from the customer's page; only the launcher and popups live in the host DOM.
- **Per-subdomain namespace (`60a41de`, "Support of multiple widget on a single Page"):** each deployment host gets its own `window.chatWidget[subdomain]`, id prefix and `event.source` filter so two widgets on one page do not react to each other's iframe.
- **Legacy prefix and flat methods (`b81a152`):** `blacksea` and `ctest` keep the old `hello-` ids and the flat `window.chatWidget.open()` API so existing customer snippets and CSS overrides keep working.
- **`event.source` check:** with several widgets from the same origin, the origin check alone would let one iframe drive another widget.
- **Co-browse in the host page:** the parent loads CobrowseIO with `allowIFrameStart: true` (`92ee28a`) and then tells the iframe to load its side. A larger change for screen-sharing 403 errors (`d2d1dc3`) was reverted the same day (`3086592`); the reason is not recorded.

> [!TODO] Needs a human: why was `d2d1dc3` (H3385 screen-sharing 403 fix) reverted, and is the hard-coded CobrowseIO license in the embed script intended to be public?

## Changing it safely

1. Edit `public/chat-widget.js`, then apply the same change to `public/chat-widget-dev.js` and `public/chat-widget-local.js`. Run `diff public/chat-widget.js public/chat-widget-dev.js` and confirm only the rows in the table above differ.
2. A new host → iframe event needs a handler registered in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`, or the iframe drops it (`isEventAllowed`).
3. A new iframe → host event needs a `case` in `handleIncomingMessages` and, if emitted with `emitEventToParent`, a new member of `ParentEventType` in `utils/emitEventsToParent/emitEventsToParent.tsx`.
4. A new window method goes in `windowMethods`; it is then on `window.chatWidget[subdomain]` and, for legacy subdomains, flat on `window.chatWidget`. Add it to [api](../api.md).
5. New launcher-side DOM ids must use `this.elements` with the prefix, and CSS must select them by suffix (`[id$="..."]`).
6. Check by serving the app locally and loading `public/chat-widget-local.js` from a test HTML page on another port; then test with two widgets (two different script hosts) on one page and below 600px width.
