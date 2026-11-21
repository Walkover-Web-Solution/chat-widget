---
covers: ["hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts", "store/index.js", "hoc/addUrlDataHoc.tsx", "config/helloApi.ts", "utils/utilities.js", "types/**", "public/chat-widget.js"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Glossary

Terms that mean something specific in this repo, or that an outsider would misread.

| Term | Meaning | In code |
|---|---|---|
| Hello | MSG91's customer-chat product and its backend. Every REST call and both sockets go to Hello. | `config/helloApi.ts` |
| CORE / HELLO (folders) | CORE is the product-agnostic postMessage registry and window listeners; HELLO holds the Hello product's handlers. A second product, the GTWY AI chatbot, used to live beside HELLO and was removed in 9a37b80. | `hooks/CORE/`, `hooks/HELLO/` |
| embed script | The plain-JS file the customer pastes on their site; draws the launcher and the iframe. | `public/chat-widget.js` |
| host page / parent | The customer's page that runs the embed script. "Emit to parent" means postMessage to it. | `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent` |
| subdomain | First DNS label of the embed script's host (the port on `localhost`); the namespace for `window.chatWidget[<subdomain>]` and DOM ids. | `public/chat-widget.js` |
| legacy subdomain | `blacksea` and `ctest`: keep the `hello-` id prefix and flat `window.chatWidget.*` methods for old snippets. | `public/chat-widget.js` |
| helloProps / `helloData` | The object passed to `initChatWidget`, and the postMessage that carries it into the iframe. | `public/chat-widget.js`, `handleHelloData` |
| `helloConfig` | The stored copy of the `helloData` payload (sessionStorage and Redux). | `handleHelloData` |
| widget token / `WidgetId` | The widget's id from `helloData.widgetToken`; first part of every Hello authorization header. `WidgetId` in localStorage is the bare token. | `config/helloApi.ts:getAuthorization` |
| `chatSessionId` | The full widget token: `widgetToken`, or `<widgetToken>_<unique_id>` for a known user. Keys the Hello slice and prefixes widget-scoped storage keys. The UI renders only once it is set. | `handleHelloData` |
| `tabSessionId` | A `Date.now()` string per browser tab (`tab_session_id` in sessionStorage). Combined as `${chatSessionId}_${tabSessionId}` it keys the appInfo slice. | `app/chatbot/page.tsx`, `hoc/addUrlDataHoc.tsx:addUrlDataHoc` |
| `urlData` | `{ chatSessionId, tabSessionId, ...appInfo[tab key] }`, stamped onto every Redux action by middleware; reducers read their key from it, not from the payload. | `store/index.js:customMiddleware` |
| `unique_id` | The host app's own user id. Makes the visitor a known user and namespaces storage. | `handleHelloData` |
| `a_clientId` / `k_clientId` | Hello client uuid of an anonymous visitor who has not sent a message yet / of a known user, or an anonymous visitor after the first send. | `config/helloApi.ts:registerAnonymousUser` |
| `uuid` | Hello's name for the client id in responses; also the postMessage that hands it to co-browse. | `types/hello/HelloReduxType.ts` |
| `pseudo_name` | Backend flag. `customer_name` is a real name only when `pseudo_name === false`; otherwise Hello generated it. | `config/helloApi.ts:getAllChannels` |
| `channel_hex` | Channel id the client proposes for a new chat, `ch-comp-<companyId>.<uuid>`. The server may return a different one. | `utils/utilities.js:generateChannelId` |
| `subThreadId` | Key of a thread in the Chat slice: a Hello channel id, or a temporary id merged into the real one later. | `store/chat/chatReducerV2.ts` |
| widget merge | A widget with both `flow_origin` and `integration` in its config; the two are added to list and send requests, and calling is disabled. | `config/helloApi.ts:getMergeParams` |
| demo widget / trial bot | `widgetInfo.demo_widget`: messages are sent as type `trial_bot` with a session id and the last 5 messages. | `components/Chatbot/hooks/useHelloIntegration.ts` |
| W2W / peer channel | Widget-to-widget conversation (`is_peer_channel`); no calling, `block` and `new-channel` socket events. | `hooks/socketEventHandler.ts` |
| generic message | The normalized message object every renderer reads (`role`, `content`, `messageJson`, `time`, …). | `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` |
| `callToken` (appInfo) | Misnamed: it holds the call id used to rejoin a call after reload, not a JWT. | `types/appInfo/appInfoReduxType.ts` |
| `call_jwt_token` / `HelloClientToken` | Per-call token returned by a `voice_call` send / the WebRTC client token from `GET /web-rtc/get-client-token/`. | `config/helloApi.ts:getClientToken` |
| Segmento | Hello's contact/user-data store; `UPDATE_USER_DATA_SEGMENTO` and `ADD_USER_EVENT_SEGMENTO` write to it. | `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` |

## Id spaces

- **Three "session" ids.** `chatSessionId` (per widget and user), the raw `tabSessionId` (per tab) and the composite `${chatSessionId}_${tabSessionId}` (per widget, user and tab) are different keys. The Hello slice uses the first, appInfo the third. See [state](ui/state.md).
- **Two channel-name formats.** The chat socket's user channel is `ch-comp-{company}-{clientId}` (hyphen); the notification socket's is `ch-comp-{company}.{clientId}` (dot). See [realtime](modules/realtime.md).
- **Three call tokens.** `HelloClientToken`, `call_jwt_token` and the appInfo `callToken` (a call id) are unrelated values. See [voice-calling](modules/voice-calling.md).
