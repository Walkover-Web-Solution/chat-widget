---
covers: ["hooks/socket.js", "hooks/socketManager.js", "hooks/socketEventEmitter.ts", "hooks/socketEventHandler.ts", "hooks/notifications/**", "hooks/coBrowser/**", "hooks/useTimeUpdate.js", "utils/preSubscribedChannels.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Realtime: chat socket, notification socket, co-browse

The iframe app keeps two socket.io connections: the **chat socket** (conversation messages, typing, channel events) and the **notification socket** (push notifications for the launcher). Both are module-level singletons driven by React hooks that `components/Chatbot/hooks/useHelloEffects.ts:useHelloEffects` mounts once per widget iframe. The co-browse manager loads the Cobrowse.io SDK into the iframe when the host page asks for it.

| File | Role |
|---|---|
| `hooks/socketManager.js` | Chat socket singleton (`SocketManager`): connect, region rebuild, subscribe/unsubscribe, emit, listener and reconnect-callback registry |
| `hooks/socket.js` | `useSocket` hook: connects once the JWT is in Redux and subscribes the user, conversation and event channels |
| `hooks/socketEventHandler.ts` | `useSocketEvents` hook: binds inbound `NewPublish` and `Typing` and turns them into Redux actions |
| `hooks/socketEventEmitter.ts` | `useTypingStatus` hook: emits outbound `typing` / `not-typing` |
| `hooks/notifications/notificationSocketManager.ts` | Notification socket singleton (near copy of the chat manager, fixed URL, no region logic) |
| `hooks/notifications/notificationSocket.ts` | `useNotificationSocket`: connects, subscribes the notification channel, registers FCM for the mobile SDK |
| `hooks/notifications/notificationSocketEventHandler.tsx` | `useNotificationSocketEventHandler`: handles `NewPublish` of `type: 'notification'` |
| `hooks/coBrowser/CBManger.ts` | `CBManger` singleton: injects `https://js.cobrowse.io/CobrowseIO.js` into the iframe |
| `utils/preSubscribedChannels.ts` | One-shot set that tells the history effect to skip a fetch for a channel subscribed before its first message |
| `hooks/useTimeUpdate.js` | `useTimeUpdate`: re-renders every interval (60 s) so relative message times stay current. Not a socket; only `components/Interface-Chatbot/Messages/MessageTime.tsx` uses it |

Related docs: Redux slices and cross-tab sync in [state](../ui/state.md); REST calls (`getJwtToken`, `getRoutingRegion`, history, channels) in [hello-api](../integrations/hello-api.md); end-to-end paths in [receive-message](../flows/receive-message.md), [send-message](../flows/send-message.md) and [widget-boot](../flows/widget-boot.md); the host-page side of co-browse in [embed-script](../modules/embed-script.md); env vars in [environment](../environment.md).

## How it works

### One socket per iframe, not shared across tabs

Each browser tab that shows the widget has its own iframe document, so it gets its own `SocketManager` instances and its own two connections. Nothing shares a socket between tabs. What is shared is Redux: `store/index.js` uses `redux-state-sync` to rebroadcast actions to other tabs, with a predicate that skips `Chat/*`, `appInfo/*`, `draftData/*` and unread-count increments (`Hello/setUnReadCount` without `resetCount`). Socket-driven `Chat/*` actions are therefore applied by each tab's own socket, and unread increments are not synced because every tab's socket already increments them (commit 7fbaa31 fixed a double count from two tabs on the same channel). See [state](../ui/state.md).

### Chat socket connection lifecycle

1. Boot (`useHelloEffects` → `initializeHelloServices`): `getRoutingRegion` stores `region_url` / `socket_url` with `config/regionConfig.ts:setRegionUrls`, then widget-info, client registration, then `config/helloApi.ts:getJwtToken` → `setJwtToken` puts the token at `state.Hello[chatSessionId].socketJwt.jwt`.
2. `hooks/socket.js:useSocket` re-runs when `jwtToken`, `eventChannels`, `channelListData` or `company_id` change. It returns early with no token; otherwise it calls `socketManager.connect(jwtToken)` and `socketManager.subscribe(channels)`.
3. `hooks/socketManager.js:SocketManager.connect` reads the URL at call time with `config/regionConfig.ts:getSocketUrl` (region `socket_url`, else `NEXT_PUBLIC_SOCKET_URL`, else the stage URL when the iframe has `?env=stage`). It opens `io(url, { auth: { token }, transports: ['websocket','polling'], reconnection: true, timeout: 20000 })`. There are no query params; the JWT goes in the socket.io `auth` payload.
4. `connect` is a no-op while connected or connecting to the same URL. A different URL tears down only the transport (`_teardownSocket`) and reconnects, keeping `channels` and queued callbacks.
5. `getRoutingRegion` calls `socketManager.reconnect()` when the region changed. It does nothing if no socket exists yet, which is the normal boot order (region resolves before the JWT).
6. Nothing in the app calls `socketManager.disconnect()`. The socket lives as long as the iframe.

### Reconnection: channels and history

- On every `connect` event (first connect and each auto-reconnect), the manager re-subscribes everything in `this.channels` with `isReconnect = true`, which skips the duplicate filter so the server gets the full list again (commit 8db4d94, "channels subscribing after socket reconnection"). Then it runs and clears `connectionCallbacks` (queued subscribes and emits).
- On the socket.io Manager's `reconnect` event (auto-reconnect only, not first connect and not a region rebuild), it calls every `reconnectionCallbacks` entry. `useHelloEffects` registers `handleReconnection` via `socketManager.onReconnect`, which calls `fetchHelloPreviousHistory()` for `currentChannelId` only (commit 6b18085, "Get history for current channel on socket re-connection"). Messages missed on other channels and unread counts are not refetched.

### Channels

| Channel | Built in | Subscribed by |
|---|---|---|
| `ch-comp-{company_id}-{clientId}` (user channel, hyphen) | `hooks/socket.js:useSocket` | `useSocket`; replaced on the `update` event |
| each `channelListData.channels[].channel` | channel list API | `useSocket` |
| each `widgetInfo.event_channels[]` (includes the typing channel) | widget-info API | `useSocket` |
| `channel_hex` proposed for a new chat | `components/Chatbot/hooks/useHelloIntegration.ts` | send path, before the first send (raced against `PRE_SUBSCRIBE_TIMEOUT_MS` = 2000) |
| `channel` and `presence_channel` from the send response | send response | send path after the first send (demo widget: `channel` only) |
| `channel` from a `new-channel` event | event payload | `useSocketEvents` |

`clientId` is `localStorage.k_clientId` (registered user) or `a_clientId` (anonymous). `subscribe` dedupes against `this.channels` and resolves `{ message: "No new channels to subscribe" }` when nothing is new. `unsubscribe` rejects when the socket is not connected; callers swallow it with `.catch(() => undefined)`. `useSocket` never unsubscribes channels that disappear from the channel list.

### Pre-subscription and the history effect

A new chat proposes its own channel id, so the send path subscribes before sending; otherwise a fast bot reply goes to a channel nobody listens on (commit 5e53fff). When the server accepts the proposed id, it calls `utils/preSubscribedChannels.ts:markPreSubscribed` before dispatching `currentChannelId`. The history effect in `useHelloEffects` calls `consumePreSubscribed(currentChannelId)` and skips `fetchHelloPreviousHistory` once, because `setInitialMessages` replaces the thread and would erase a reply the socket already delivered. If the server returns a different channel, the send path unsubscribes the proposed one so reconnects do not revive it.

## Contracts

### Inbound events on the chat socket

`NewPublish`, handled by `hooks/socketEventHandler.ts:useSocketEvents`:

```ts
{ response: {
    id?: string, timetoken?: string, company_id?: string,
    message: {
      type: 'chat'|'assign'|'feedback'|'block'|'new-channel'|'update',
      channel: string, new_event?: boolean,
      chat_id?: string, client_sender_id?: string,   // own-message detection
      message_type?: 'voice_call'|..., content?: { status?: string, ... },
      // type-specific: assignee_type, assignee_id, channel_details, value, client_id,
      // ticket_id, customer_name, last_message, cc_unread_count, widget_unread_count, created_at, current
} } }
```

`timetoken` is copied onto `message.timetoken`. The message id used is `response.id || response.message.id || response.timetoken`. "Own message" = has `chat_id` and either no `client_sender_id` or one equal to this client id (peer widget-to-widget messages also carry `chat_id`, commit 17706c8).

Before the switch: if `new_event` and `type` is `chat` or `feedback` and not own → `Hello/setUnReadCount { channelId, resetCount: false }` and `Hello/moveChannelToTop`.

| `message.type` | Condition | Redux / side effects |
|---|---|---|
| `chat` | `new_event` | `Hello/setChannelClosedStatus { is_closed: false }` (a new message reopens a closed chat) |
| `chat`, `message_type: 'voice_call'` | `content.status` in completed / no_answer / in-progress | `Chat/setHelloEventMessage`, extra `setUnReadCount` and `moveChannelToTop`; on `completed` for the open channel, `helloVoiceService.emitEvent('call-completed')` (which makes `useHelloEffects` refetch history). Returns early. |
| `chat` | not own | `setLoading(false)`, `playMessageRecivedSound()`, `Chat/setHelloEventMessage`, `Chat/setTyping { data: false }` |
| `chat` | own, tab hidden | `Chat/setHelloEventMessage` (sync a message sent from another tab of the same widget, commit 79db2ff) |
| `chat` | own, tab visible | `moveChannelToTop`, `Chat/updateHelloMessage` (merges server fields into the optimistic message) |
| `assign` | always | `Hello/changeChannelAssigned { assigned_type, assignee_id, channelId: channel_details.channel }` |
| `feedback` | `new_event` | `Chat/setHelloEventMessage`, `Hello/setChannelClosedStatus { is_closed: true }` |
| `block` | `new_event` and `channel` | `Hello/setChannelBlockedStatus { is_blocked: !!value }` (peer channel blocked by the other side) |
| `new-channel` | `new_event` and `channel` | `Hello/addChannel {...}`, `socketManager.subscribe([channel])`, then `fetchChannels()` to hydrate peer / assignment fields |
| `update` | `new_event` and `client_id` | writes the new id to `k_clientId` if that key exists, else `a_clientId`; unsubscribes `channel`; subscribes `ch-comp-{response.company_id}-{client_id}` |

`Typing`, payload `{ channel, type: 'chat', action: 'typing'|'not-typing' }` → `Chat/setTyping { subThreadId: channel, data: true|false }`.

### Outbound emits on the chat socket

| Event | Payload | From |
|---|---|---|
| `subscribe` | `{ channel: string[] }`, ack logged | `SocketManager._doSubscribe` |
| `unsubscribe` | `{ channel: string[] }` | `SocketManager.unsubscribe` |
| `typing` / `not-typing` | `{ channel: <event_channels entry containing "typing">, data: { action, channel: currentChannelId } }` | `hooks/socketEventEmitter.ts:useTypingStatus`, called from `components/Interface-Chatbot/ChatbotTextField.tsx` (typing on input, not-typing after 2 s debounce and on send) |

`useTypingStatus` sends `typing` once and `not-typing` once per burst (`hasSentTyping` ref), and nothing when there is no current channel or no typing event channel.

### Notification socket

- URL: `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` (the typo is the real variable name), or a hard-coded stage URL when the iframe URL has `?env=stage`. Read once at module load. No region routing.
- `hooks/notifications/notificationSocket.ts:useNotificationSocket` connects with the same chat JWT (`auth: { token }`) only when it has `jwtToken`, `company_id`, a client id, and, for `helloConfig.isMobileSDK`, a `pushConfig`.
- Channel: `ch-comp-{company_id}.{clientId}` (dot, unlike the chat user channel's hyphen).
- Mobile SDK with `pushConfig.access_token` or `pushConfig.fcm`: also calls `config/helloApi.ts:subscribeForFCMPushNotification({ ...pushConfig, user_channel })` (`POST {NEXT_PUBLIC_PUSH_NOTIFICATION_URL}/add-user-fcm-token/`). Without a token it stays on the socket only (commit e3e44f8).
- Inbound `NewPublish` with `message.type === 'notification'` and non-null `content`:
  - `message_type` `Popup` or `custom` (any case) → `emitEventToParent('PUSH_NOTIFICATION', message)`; the host page renders the overlay.
  - `message_type` `Message` → `Chat/addNotification { id: generateNewId(), content, timestamp }` and `emitEventToParent('LAUNCHER_MESSAGE_PREVIEW', { ...message, notificationId })`; the host echoes `notificationId` back on open so the notification can be marked read.
  - Then calls the socket.io ack callback with `message` (commit 25e2aca).

### Co-browse

Co-browse lets a support agent view the visitor's page through Cobrowse.io. The trigger chain:

1. After client registration, `useHelloEffects` emits `emitEventToParent('uuid', { uuid })`.
2. The embed script (`public/chat-widget.js`, its `CobrowseManager`) loads the Cobrowse SDK in the host page with the license and `customData.device_id = uuid`, starts it with `allowIFrameStart: true`, then posts `ADD_COBROWSE_SCRIPT { origin }` to the iframe. Mobile SDK hosts get the uuid forwarded instead and no script.
3. `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` handles `ADD_COBROWSE_SCRIPT` with `CBManger.injectScript(origin)`.
4. `hooks/coBrowser/CBManger.ts:CobrowseManager.injectScript` needs a client id and an origin. First call: appends `<script id="CBChildScript">`, then sets `trustedOrigins = [origin]` and calls `CobrowseIO.start()`. Later calls with a different client id only update `customData.device_id`.

## Gotchas

> [!WARNING]
> `SocketManager.on` is a no-op while `this.socket` is null, and `_teardownSocket` calls `removeAllListeners()`. `useSocketEvents` only works because its effect re-binds on almost every render: `handleNewMessage` depends on `addHelloMessage`, which is recreated each render. If you memoize `addHelloMessage` or tighten those deps, `NewPublish`/`Typing` listeners stop being attached after the socket is created or rebuilt. Add an explicit connection signal first. The `listeners` map is bookkeeping only; nothing replays it.

> [!WARNING]
> `useNotificationSocketEventHandler` binds when `handleNewMessage` changes or when `socketManager.isConnected` (read during render, not reactive) differs between renders. It relies on some later re-render of `Chatbot` after the notification socket connects.

> [!WARNING]
> `connect(jwt)` ignores a new token while connected to the same URL. A changed JWT does not re-authenticate the chat socket; only a URL change or `reconnect()` rebuilds it.

> [!WARNING]
> The `useHelloEffects` cleanup does `socketManager.reconnectionCallbacks = []`, wiping every reconnect callback, not just its own. Use `offReconnect(cb)` if you add a second registrant.

> [!WARNING]
> The `chat` case destructures `content: { status }` from `message`. A `chat` event without `content` throws inside the handler and the message is dropped.

> [!WARNING]
> Own-message handling depends on tab visibility: a visible tab only merges (`updateHelloMessage`) and does not append. Two visible windows on the same widget, where one did not send the message, will not show it until history reloads.

> [!WARNING]
> The notification manager never records channels (the `this.channels.push` line is commented out), so it does not re-subscribe after an auto-reconnect. It also reads `window.location.search` at import with no `typeof window` guard, unlike `config/regionConfig.ts`. Import it only from client-only code.

> [!WARNING]
> `useSocket` defaults `company_id` to `[]`, which is truthy; with no company id the user channel becomes `ch-comp--{clientId}`. The `update` handler builds the new channel from `response.company_id`, defaulting to `null`.

> [!WARNING]
> `useTypingStatus`'s callback only lists `currentChannelId` as a dependency, so a typing channel that arrives after the callback was created is not seen until the channel changes.

## Why it is built this way

- **Singleton managers with queues.** Many hooks subscribe and emit before the socket is up. `subscribe` and `emitEvent` queue into `connectionCallbacks` instead of failing. `subscribe` waits indefinitely while disconnected, so the send path races it with a 2 s timeout so a dead socket cannot block sending.
- **URL resolved at connect time, transport-only teardown** (commit c6ea9c1, "region-wise api calling, bug fix of socket connection"): the socket must go to the widget's region from `routing-region`. Reading the URL at module load pinned it to the default region. Teardown keeps channels and queued callbacks so nothing queued before the region resolved is lost.
- **Resubscribe on every `connect` without dedupe** (commit 8db4d94): after a server-side reconnect the server forgets subscriptions, but the client's `channels` list still has them, so the dedupe filter used to drop them all.
- **History refetch on reconnect** (commit 6b18085): messages published while disconnected are not replayed by the socket.
- **Pre-subscription** (commit 5e53fff): bot replies can arrive before the send response tells the client its channel.
- **Not syncing unread increments across tabs** (commit 7fbaa31): each tab's socket already counts the message.
- **Co-browse device id fix reverted.** Commit d2d1dc3 converted 24-hex client ids to a Python bytes repr for Cobrowse `device_id` to fix "Hello Screen Sharing Fails with 403", and 3086592 reverted it the same day.

> [!TODO] Needs a human: is the co-browse 403 (H3385) still open, and what is the correct `device_id` format the agent side filters on?

> [!TODO] Needs a human: why does the notification socket not record its channels for resubscription (commented out since commit 2e64a21)? Is that deliberate?

## Changing it safely

- **New inbound event type:** add a `case` in `hooks/socketEventHandler.ts:useSocketEvents` and the reducer in the Hello or Chat slice. Decide whether the action should cross tabs: `Hello/*` actions are rebroadcast by `redux-state-sync`, so an action that each tab's socket also receives will be applied twice. Make it idempotent or add it to the predicate in `store/index.js`.
- **New outbound emit:** use `socketManager.emitEvent(name, payload, ack)`; it queues until connected. Follow the `typing` shape (`{ channel, data }`) when it targets an event channel.
- **New channel:** subscribe through `socketManager.subscribe` so it is tracked and resubscribed on reconnect. Unsubscribe channels you abandon, or every reconnect revives them.
- **Socket URL or auth:** change `config/regionConfig.ts` and `hooks/socketManager.js:SocketManager.connect` together; the notification manager has its own copy of the connect code and URL.
- **Check:** in the browser, open the iframe, watch the WebSocket frames for `subscribe` with the expected channel list. Toggle the network offline and back: you should see `subscribe` with the full list again and a history request for the open channel. Open two tabs on the same widget and confirm unread counts do not double.
