---
covers: ["app/rag/**", "public/rag-prod.js", "public/rag-dev.js", "public/rag-local.js", "config/ragApi.ts", "hooks/notifications/**", "hooks/coBrowser/**"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# RAG embed, notification socket and co-browsing

Three small, unrelated features that live beside the chat widget:

1. **RAG embed.** A GTWY customer puts `public/rag-prod.js` on their own page. It lets their users upload documents into a GTWY knowledge base. The script draws a document list on the host page and opens an iframe pointing at this app's `/rag` route (`app/rag/page.tsx`). It does not use the chat widget, Redux or Hello.
2. **Notification socket.** The Hello widget opens a second socket.io connection, separate from the Hello chat socket. Campaign push notifications arrive on it. They are either forwarded to the host page or stored in `state.Chat.notifications`. Mobile-SDK hosts also register an FCM token.
3. **Co-browsing.** `hooks/coBrowser/CBManger.ts` loads the CobrowseIO SDK (cobrowse.io) inside the widget iframe so an agent's co-browse session can include the iframe. The host script starts CobrowseIO first, then tells the iframe to join.

| File | Role |
|---|---|
| `public/rag-prod.js` | Host-page loader (IIFE, class `RagEmbedManager`). Reads attributes from `<script id="rag-main-script">`, logs in with the embed token, lists documents, opens the `/rag` iframe in a modal or inside a parent element, sets globals on `window`. |
| `public/rag-dev.js`, `public/rag-local.js` | Copies of `rag-prod.js` that differ only in `this.urls` (see [drift](#env-variant-drift)). |
| `public/rag.css` | Styles for the host-side list, modal and toasts. Loaded by the script from `urls.cssURL`. |
| `app/rag/page.tsx` | `RagComponent`: the create/edit form inside the iframe. Talks to the host only by `postMessage`. Calls `config/ragApi.ts`. Also embeds the viaSocket "Connect Drive Documents" flow. |
| `config/ragApi.ts` | Knowledge-base CRUD against `NEXT_PUBLIC_API_BASE_URL` (`createKnowledgeBaseEntry`, `getAllKnowBaseData`, `updateKnowBaseData`, `deleteKnowBaseData`). |
| `hooks/notifications/notificationSocketManager.ts` | Singleton `SocketManager` (socket.io-client) for the notification server. |
| `hooks/notifications/notificationSocket.ts` | `useNotificationSocket`: connects, subscribes to the user channel, registers FCM for the mobile SDK. |
| `hooks/notifications/notificationSocketEventHandler.tsx` | `useNotificationSocketEventHandler`: handles `NewPublish`, routes each notification by `message_type`. |
| `hooks/coBrowser/CBManger.ts` | `CBManger` (instance of `CobrowseManager`): injects `https://js.cobrowse.io/CobrowseIO.js` into the iframe and starts it. The file name is misspelled ("Manger"). Keep it; it is imported by that name. |

## How it works

### RAG embed: host side (`public/rag-*.js`)

1. When the script loads, it creates `RagEmbedManager`, which runs `initializeEventListeners`: it loads `rag.css`, watches `document.head` for the `rag-main-script` tag being added or removed, and adds two `message` listeners plus a resize observer. It then sets the `window` globals and calls `initializeRag`.
2. `loadContent` (on `DOMContentLoaded`, or straight away if `body` exists):
   - reads the script tag's attributes in `extractScriptProps`;
   - creates the overlay `#rag-modal-overlay`, the container `#rag-iframe-parent-container` and the iframe `#iframe-component-ragInterfaceEmbed`;
   - creates the list modal `#rag-document-list-modal`.
   If the `parentId` attribute names an element that exists, the iframe is mounted inside it ("embedded"). Otherwise it goes in `body` as a popup.
3. `loadRagEmbed`: if there is an `embedToken`, `authenticateUser` calls `GET urls.login` with `Authorization: <embedToken>` and stores `data.data.token` (or `accessToken`) in `this.token`. Then it sets `iframe.src = urls.ragUrl` and waits for `onload` (10 s timeout).
4. When the iframe loads (and again when the iframe posts `ragLoaded`), `sendInitialData` posts `INITIAL_CONFIG` once per iframe, guarded by `iframe.dataset.initialDataSent`. The message carries every script attribute plus `token`, `isEmbedded` and `timestamp`. If `defaultOpen` is `"true"`, it also calls `showDocumentList`.
5. `showDocumentList` → `fetchDocuments`: `GET urls.docsApi` with header `Proxy_auth_token: this.token`. It then renders each document with an edit/delete menu. "Edit" opens the modal and sends `EDIT_DOCUMENT` (`waitForIframeReadyAndSendEdit` retries until the iframe is ready). "Delete" asks `confirm()`, sends `DELETE_DOCUMENT` and refreshes the list after 1 s. "Add" (`openRag`) sends `OPEN_ADD_DOCUMENT`.
6. `sendMessageToIframe` adds `data.token` and `data.timestamp` to every message and posts it after a 500 ms `setTimeout`.

Host page snippet:

```html
<script id="rag-main-script" src="https://chatbot.gtwy.ai/rag-prod.js"
        embedToken="<GTWY embed token>" parentId="my-div" theme="dark"
        chunkingType="semantic" hideConfig="true" defaultOpen="true"></script>
```

The attributes `extractScriptProps` reads are `embedToken`, `chunkingType`, `hideConfig`, `listPage`, `onOpen`, `onClose`, `className`, `parentId`, `config`, `hideIcon`, `theme` and `defaultOpen`. All values are strings.

Globals set on `window` (all on the host page):

| Global | Calls |
|---|---|
| `window.RagEmbedManager` | the manager instance itself |
| `window.ragEmbed.{openRag, closeRag, showDocuments, closeDocuments, updateConfig, destroy}` | the public methods |
| `window.openRag`, `window.closeRag`, `window.showDocuments`, `window.closeDocuments`, `window.updateConfig`, `window.destroy` | the same methods, as bare globals |

### RAG embed: iframe side (`app/rag/page.tsx`)

1. On mount the page posts `{ type: "ragLoaded" }` to `window.parent`.
2. On `INITIAL_CONFIG` it stores `data` as `configuration` and writes `configuration.token` to sessionStorage as `ragToken`. `utils/interceptor.ts` sends that value as the `proxy_auth_token` header on every axios request whose URL contains `"rag"`. With a token present, it also calls `getEmebedToken` (`config/api.ts`, `GET ${NEXT_PUBLIC_API_BASE_URL}/rag/get-emebed-token`). That embed token loads `https://embed.viasocket.com/prod-embedcomponent.js` for the "Connect Drive Documents" button (`openViasocket` with a fixed `templateId`).
3. Save:
   - **Create.** Builds a `FormData` with `name`, `description`, `chunking_type`, `chunk_size` and `chunk_overlap`, plus either `file` (PDF, DOC, DOCX or CSV only, per `VALID_FILE_TYPES`) or `url`. Sends it with `createKnowledgeBaseEntry` → `POST /rag`. The `chunkingType`, `chunkSize` and `chunkOverlap` from the host config override the form fields.
   - **Edit.** Sends JSON with `updateKnowBaseData` → `PATCH /rag/docs/:id`. The file or URL cannot change.
4. `DELETE_DOCUMENT` → `deleteKnowBaseData` → `DELETE /rag/docs/:id`.
5. viaSocket: a `message` from origin `https://embedfrontend.viasocket.com` with `action: "published"` creates an entry from `{ name: title, description, url: webhookurl }`.
6. After a successful operation the page posts a `rag` message, then `closeRag`. The host shows a toast, refreshes the list if it is embedded or `defaultOpen`, and closes the modal.

Knowledge-base CRUD endpoints (full list: [api](../api.md)):

| Caller | Request |
|---|---|
| host `fetchDocuments` | `GET {docsApi}` (`/rag/docs` on the GTWY db host), header `Proxy_auth_token` |
| host `authenticateUser` | `GET {login}` (`/user/embed/login`), header `Authorization: <embedToken>` |
| `createKnowledgeBaseEntry` | `POST ${NEXT_PUBLIC_API_BASE_URL}/rag` (multipart, or JSON from viaSocket) |
| `getAllKnowBaseData` | `GET .../rag/docs`. Not called anywhere in this repo; the host script fetches the list itself. |
| `updateKnowBaseData` | `PATCH .../rag/docs/:id` |
| `deleteKnowBaseData` | `DELETE .../rag/docs/:id` with body `{ id }` |
| `getEmebedToken` | `GET .../rag/get-emebed-token` |

### Notification socket

Both hooks run from `components/Chatbot/hooks/useHelloEffects.ts`, so only in Hello mode.

1. `useNotificationSocket` waits until all of these are true:
   - `Hello[chatSessionId].socketJwt.jwt` is set (fetched by `getJwtToken`);
   - `widgetInfo.company_id` is set;
   - localStorage holds `k_clientId` or `a_clientId`;
   - for the mobile SDK, `helloConfig.pushConfig` is set.
   It then calls `socketManager.connect(jwt)`. The URL is `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` (the typo is the real variable name), or a hardcoded phone91 notifications host when the iframe URL has `?env=stage`. The JWT is sent as `auth.token`.
2. It subscribes to `ch-comp-<company_id>.<uuid>`, where `uuid` is `k_clientId` if present, else `a_clientId`. The client emits `subscribe` with `{ channel: [...] }`.
3. Mobile SDK only: when `pushConfig.access_token` or `pushConfig.fcm` is set, it calls `subscribeForFCMPushNotification({ ...pushConfig, user_channel }, jwt)`. That is `POST ${NEXT_PUBLIC_PUSH_NOTIFICATION_URL}/add-user-fcm-token/` in `config/helloApi.ts` (see [hello](../integrations/hello.md)).
4. `useNotificationSocketEventHandler` listens for `NewPublish` and acts only when `response.message.type === "notification"` and `content` is set:
   - `message_type === "Popup"`, or `"custom"` in any letter case → `emitEventToParent('PUSH_NOTIFICATION', message)`. The host script renders it, or passes it to the mobile SDK.
   - `message_type === "Message"` → `addNotification({ id, content, timestamp })` (the reducer adds `read: false` and puts it first), then `emitEventToParent('LAUNCHER_MESSAGE_PREVIEW', { ...message, notificationId })`.
   - In both cases it calls the socket ack callback with `message`.
5. When the user clicks the launcher preview, the host posts `OPEN_WITH_NOTIFICATION { content, notificationId }`. `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` opens a new `notification-<id>` sub-thread, shows the content as a bot message and calls `removeNotification`. `NotificationPage` lists the stored ones; see [chat-ui](chat-ui.md#notifications).

Where the notifications are stored: `store/combineReducer.js` wraps `Chat` in its own `persistReducer` with `whitelist: ["notifications"]` and widget-scoped localStorage. The root persist config blacklists `Chat`, so `notifications` is the only part of the Chat slice that is persisted. `resetState` in `store/chat/chatReducerV2.ts` keeps `notifications`. `Chat/*` actions are not synced across tabs (predicate in `store/index.js`).

```ts
// state.Chat.notifications item (store/chat/chatReducerV2.ts)
{ id: string; content: string /* raw HTML */; timestamp: number; read: boolean }
```

```js
// NewPublish payload as read by the handler
{ response: { message: { type: "notification", message_type: "Popup"|"Custom"|"Message", content, ...rest } } }
```

### Co-browsing

1. After Hello registration, `useHelloEffects.ts` posts `emitEventToParent('uuid', { uuid })`. The comment there says this is "used to subscribe to cobrowse".
2. The host script `public/chat-widget.js` (class `CobrowseManager`, see [embed-scripts](embed-scripts.md#postmessage-protocol)) loads CobrowseIO on the host page. It sets `customData.device_id = uuid`, its license key and `trustedOrigins`, starts it, and posts `ADD_COBROWSE_SCRIPT { origin }` to the iframe. On the mobile SDK, `uuid` goes to the native app instead.
3. `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:handleAddCoBrowseScript` calls `CBManger.injectScript(origin)`. That adds `<script id="CBChildScript">` with the CobrowseIO SDK. On load it sets `trustedOrigins = [origin]` and calls `CobrowseIO.start()`, so the iframe acts as a child frame of the host's session. An agent starts the session from the cobrowse.io dashboard, finding the user by `device_id`.

## Contracts

postMessage between the RAG host script and the `/rag` iframe. All messages use target origin `*`, and neither side checks `event.origin`.

| Direction | `type` | Payload |
|---|---|---|
| host → iframe | `INITIAL_CONFIG` | `{ ...scriptAttrs, token, isEmbedded, timestamp }` |
| host → iframe | `OPEN_ADD_DOCUMENT` | `{ action: 'add_new', token }`. The page resets the form only when `action === 'add'`, so in practice this message does nothing. |
| host → iframe | `EDIT_DOCUMENT` | `{ document: KnowledgeBaseType, token, timestamp }` |
| host → iframe | `DELETE_DOCUMENT` | `{ action: 'delete', document, token, timestamp }` (uses `document._id`) |
| iframe → host | `ragLoaded` | none |
| iframe → host | `rag` | `{ status: 'create'|'update'|'delete', data }` on success |
| iframe → host | `iframe-message-rag` | `{ status, error }` on failure. The viaSocket create success also uses this type, with `data` and no error. |
| iframe → host | `closeRag` | none (the host also accepts `CLOSE_RAG`) |
| any → host | `OPEN_RAG`, `SHOW_DOCUMENT_LIST` | opens the modal / the list |
| host → its own parent | `open`, `close` | `{}`. Sent with `window.parent.postMessage`, for hosts that are themselves inside a frame. |

```ts
// KnowledgeBaseType (app/rag/page.tsx)
{ _id, name, description, doc_id, org_id, chunks_id_array: string[], user_id: string|null, type,
  source?: { type: string /* "url" */, data: { url?: string } } }
```

`chunking_type` values come from `KNOWLEDGE_BASE_CUSTOM_SECTION` in `utils/enums.ts`: `auto`, `semantic`, `manual` and `recursive`.

## Env variant drift

As of b9ab6d6, `rag-dev.js` is identical to `rag-prod.js` except for the four `this.urls` values. `rag-local.js` differs in the same four URLs plus whitespace and formatting only; there is no change in behaviour.

| `this.urls` key | prod | dev | local |
|---|---|---|---|
| `ragUrl` | `chatbot.gtwy.ai/rag` | `dev-chatbot.gtwy.ai/rag` | `localhost:3001/rag` | <!-- verify:ignore -->
| `login` | `db.gtwy.ai/user/embed/login` | `dev-db.gtwy.ai/...` | `localhost:7072/...` | <!-- verify:ignore -->
| `docsApi` | `db.gtwy.ai/rag/docs` | `dev-db.gtwy.ai/...` | `localhost:7072/...` | <!-- verify:ignore -->
| `cssURL` | `chatbot.gtwy.ai/rag.css` | `dev-chatbot.gtwy.ai/rag.css` | `localhost:3001/rag.css` | <!-- verify:ignore -->

The backend hosts are hardcoded in the scripts; no env var sets them. The iframe's own API calls use `NEXT_PUBLIC_API_BASE_URL` (values: [environment](../environment.md)), so the two must point to the same backend.

## Gotchas

> [!WARNING]
> **Notification channels are not re-subscribed after a reconnect.** `_doSubscribe` has `this.channels.push(...)` commented out, so `channels` stays empty. The `connect` handler's "re-subscribe on reconnection" therefore does nothing. After socket.io reconnects, the user channel is lost until `useNotificationSocket`'s effect runs again (its deps are `jwtToken`, `company_id`, `pushConfig` and `isMobileSDK`). The same gap means the duplicate filter never filters anything.

> [!WARNING]
> `notificationSocketManager.ts` reads `window.location.search` at module load. Import it only from client components and hooks, never from server code.

> [!WARNING]
> The axios interceptor uses the RAG token whenever `config.url` contains `"rag"` **anywhere** (for example `storage` or `drag`). Such requests get `proxy_auth_token` from `ragToken` and no `Authorization` header. A 401 on any axios call clears all of localStorage and redirects. Keep RAG URLs distinct, and do not add non-RAG endpoints whose URL contains "rag".

> [!WARNING]
> Host-script bugs that fail without notice:
> - The class defines `destroy()` twice. The second one, which only runs `cleanupRag`, wins, so observers and listeners are never removed.
> - `updateConfiguration` calls `sendInitialData`, which returns early once `initialDataSent === 'true'`. As a result, `window.updateConfig(...)` never reaches the iframe.
> - `showErrorMessage` does not exist, so a failure in `loadRagEmbed` throws a `TypeError`.
> - `showDocumentList`'s catch passes `this.messageHandler.error` (undefined) as the toast class.
> - `window.destroy` and `window.updateConfig` are bare globals that can clash with the host page's own code.

> [!WARNING]
> In `app/rag/page.tsx`, the catch in `handleSave` uses `{ id }`, but no `id` is in scope. If the error has no `response.data`, this throws a `ReferenceError` inside the catch, and the host never hears about the failure. The viaSocket `message` listener is added without being removed and has an empty dependency array.

> [!WARNING]
> `CBManger.injectScript` with the **same** uuid after the first injection adds a second `CBChildScript` tag. It only short-circuits when the uuid has changed. Guard on `scriptInjected` before you call it more than once.

> [!WARNING]
> Notification `content` is raw campaign HTML. `NotificationPage` renders it in a no-script sandboxed iframe. "Chat with us" renders it as a `pushNotification` message, which executes scripts (see [chat-ui](chat-ui.md#gotchas)).

## Why it is built this way

- **The stage URL is hardcoded in the notification manager** (1f19031, "handling for notification socket URL"). Stage iframes (`?env=stage`) must reach the stage notification server whatever the build's env var says. Hello does the same for its host URL.
- **FCM registration needs a token** (e3e44f8). An earlier version registered whenever `pushConfig` existed, which broke socket subscription in mobile apps that had no FCM token. Now the socket channel is always subscribed, and FCM only when `access_token` or `fcm` is present.
- **`Message` notifications are stored and previewed, not popped up** (36fbeea, #468). They feed the launcher preview and `NotificationPage`. `notificationId` is sent to the host so that `OPEN_WITH_NOTIFICATION` can remove the right item. Ack callbacks were added in 25e2aca. `Custom` handling was added in 694a67e.
- **Co-browsing starts on the host first** (8c326ac, "screen sharing v2"). CobrowseIO must run in the top page and trust the iframe. The iframe joins only after the host's `client()` resolves, which is why `ADD_COBROWSE_SCRIPT` comes from the host and not from the iframe.

> [!TODO] Needs a human: which GTWY product pages embed `rag-prod.js`? Is `getAllKnowBaseData` (unused) safe to delete?

## Changing it safely

- **RAG host script.** Edit `public/rag-prod.js`, `public/rag-dev.js` and `public/rag-local.js` together. Only `this.urls` may differ. Check with `diff public/rag-prod.js public/rag-dev.js`, which should show only lines 11–14.
- **New postMessage type.** Add it on both sides: the host `handleIncomingMessages` / `initialiseMessageListeners`, and the `handleMessage` switch in `app/rag/page.tsx`. Remember that the host's `lastProcessedMessage` drops a message identical to the previous one.
- **New notification `message_type`.** Change `notificationSocketEventHandler.tsx`. If it goes to the host, also handle it in all three `public/chat-widget*.js` copies (see [embed-scripts](embed-scripts.md)).
- **Notification shape.** If you change it, keep `addNotification`, `removeNotification` and `NotificationPage` in step. Because the items are persisted, old shapes stay in users' localStorage. Bump `chatPersistConfig.version` or write code that tolerates both shapes.
- **Checking it works.** For RAG, serve the app on :3001, load `rag-local.js` on a test page with a valid `embedToken`, and create, edit and delete a document. For notifications, watch for `Subscribed channels data:` in the iframe console and publish to `ch-comp-<company>.<uuid>`.
