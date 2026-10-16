---
covers: ["config/helloApi.ts", "config/regionConfig.ts", "store/hello/**", "types/hello/**", "components/Chatbot/hooks/useHelloIntegration.ts", "components/Chatbot/hooks/useHelloEffects.ts", "components/Chatbot/hooks/HelloVoiceService.ts", "components/Chatbot/hooks/useCallUI.ts", "components/Hello/**", "hooks/HELLO/eventHandlers/localStorage/**", "components/Interface-Chatbot/CallButton.tsx", "hooks/socketManager.js", "hooks/socket.js", "hooks/socketEventHandler.ts"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# MSG91 Hello

MSG91 Hello is the human-agent backend: the widget registers a client (anonymous or identified), lists that client's channels (tickets), sends messages, receives agent/bot replies over socket.io, collects feedback, and places WebRTC voice calls through `msg91-webrtc-call`. The widget is a Hello widget when the host page posted `helloData` (see [embed-scripts](../modules/embed-scripts.md)), which sets `draftData.isHelloUser = true`. The end-to-end hop list lives in [hello-human-chat](../flows/hello-human-chat.md).

> [!WARNING]
> Every Hello call in `config/helloApi.ts` swallows its error: it shows `errorToast` and returns `null` / `[]`. Callers never see a rejected promise. Check the return value (`if (!data)`), not `try/catch`. `useOnSendHello` relies on this (`if (!data && preSubscribed)`), and `RenderHelloFeedbackMessage` gets it wrong: it marks feedback as submitted even when `submitFeedback` returned `null`.

## Files

| File | Role |
|---|---|
| `config/helloApi.ts` | The only Hello REST client. Builds the `authorization` header, reads/writes client ids in localStorage. |
| `config/regionConfig.ts` | In-memory region base URLs (`getHelloHostUrl`, `getSocketUrl`, `setRegionUrls`). |
| `utils/helloInterceptor.ts` | Bare axios instance used by `helloApi.ts` (its error interceptor is commented out). |
| `components/Chatbot/hooks/useHelloEffects.ts` | Boot sequence (`initializeHelloServices`), history fetch on channel change, unread reset, badge count, reconnect refetch. Mounted once by `components/Chatbot/Chatbot.tsx`. |
| `components/Chatbot/hooks/useHelloIntegration.ts` | Hooks used by the UI: `useOnSendHello` (send + new channel), `useSendMessageToHello` (text field wrapper), `useFetchChannels`, `useFetchHelloPreviousHistory`, `useGetMoreHelloChats`, `useHelloMessages`. |
| `hooks/socketManager.js` | socket.io singleton (`socketManager`): connect, subscribe queue, reconnect on region change. |
| `hooks/socket.js` | `useSocket`: connects with the socket JWT and subscribes the client, channel and event channels. |
| `hooks/socketEventHandler.ts` | `useSocketEvents`: handles `NewPublish` and `Typing` socket events. |
| `hooks/socketEventEmitter.ts` | `useTypingStatus`: emits `typing` / `not-typing`. |
| `store/hello/helloReducer.ts`, `store/hello/helloSlice.ts` | The `Hello` slice, keyed by `chatSessionId`. |
| `store/hello/helloSaga.ts`, `store/hello/helloGeneratorFunctions.ts` | `getHelloDetailsSaga` — despite the name this is the **GTWY** bridge subscribe (`getHelloDetailsApi` in `config/api.ts`), not MSG91 Hello. See [ai-chat](../modules/ai-chat.md). |
| `types/hello/HelloReduxType.ts` | `$HelloReduxType`, `HelloData` (host config), `ChannelListData`, `Channel`. |
| `components/Chatbot/hooks/HelloVoiceService.ts` | WebRTC singleton (`helloVoiceService`) wrapping `msg91-webrtc-call`. |
| `components/Chatbot/hooks/useCallUI.ts` | React bridge to `helloVoiceService` events. |
| `components/Hello/callUI.tsx` | Call bar (incoming / calling / connected / rejoined). |
| `components/Interface-Chatbot/CallButton.tsx` | Phone button rendered by `components/Interface-Chatbot/ChatbotTextField.tsx`; starts an outgoing call. |
| `components/Hello/RenderHelloFeedbackMessage.tsx` | Post-chat rating card → `submitFeedback`. |
| `components/Hello/RenderHelloInteractiveMessage.tsx` | WhatsApp-style interactive messages (button, list, carousel, product…); delegates Apple payloads. |
| `components/Hello/AppleInteractiveMessage.tsx` | Apple Messages for Business payloads (1200 lines; structure below). |
| `components/Hello/RenderHelloAttachmentMessage.tsx` | Image attachments + caption. |
| `components/Hello/RenderHelloVedioCallMessage.tsx` | "Join Meet" link message (a meeting URL, not WebRTC). |
| `hooks/HELLO/eventHandlers/localStorage/localStorageEventsHandler.ts` | Mirrors `k_clientId` / `a_clientId` localStorage writes into the `Hello` slice. |
| `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Host → iframe events (`helloData`, `SHUTDOWN_CHATBOT`, `SHOW_TICKET`…). Owned by [embed-scripts](../modules/embed-scripts.md); summarized here only where it sets identity. |

## Connection

- **Base URL:** `getHelloHostUrl()` — the region from `/routing-region/` if resolved, else `NEXT_PUBLIC_MSG91_HOST_URL`, or a hardcoded stage host when the iframe URL has `?env=stage`. Socket: `getSocketUrl()` with `NEXT_PUBLIC_SOCKET_URL` as default. FCM push uses `NEXT_PUBLIC_PUSH_NOTIFICATION_URL`. Values: [environment](../environment.md).
- **Client:** `config/helloApi.ts` is the only code that calls the Hello REST API. `HELLO_HOST_URL` is a function, resolved per call.
- **Auth:** header `authorization`, no bearer prefix:
  - `getAuthorization()` → `"<WidgetId>:<clientId>"`, where clientId is `k_clientId` or else `a_clientId`.
  - `/routing-region/`, `/widget-info/`, `/anonymous-client-details/` send only `<WidgetId>`.
  - `getAllChannels` and `getGreetingQuestions` fall back to bare `<WidgetId>` when no client id exists yet.
  - The socket authenticates with `auth: { token: <jwt_token from /jwt-token/> }`.

## Identity model

Terms:

| Name | Where | Meaning |
|---|---|---|
| `widgetToken` | host `helloData` payload | The Hello widget id. Stored as localStorage `WidgetId` and sent in every `authorization` header. |
| `fullWidgetToken` / `chatSessionId` | sessionStorage `widgetToken`, `draftData.chatSessionId` | `widgetToken`, or `widgetToken` + "_" + `unique_id` when the host passes a `unique_id`. Keys the `Hello` slice and prefixes localStorage. `useHelloEffects` recovers the bare token with `split('_')[0]`. |
| `unique_id`, `mail`, `number`, `name`, `user_jwt_token` | localStorage `userData` | Host-supplied identity. Any of `unique_id` / `mail` / `number` = "identified user". |
| `a_clientId` | localStorage | Hello client uuid for an **anonymous** client (from `/anonymous-client-details/`). |
| `k_clientId` | localStorage | Hello client uuid for a **known** client (identified user, or anon who has sent a message). |
| `uuid` | `channelListData.uuid` | The client uuid the server resolved in `/pubnub-channels/list/`; written back to `k_clientId`/`a_clientId`. |
| `presence_channel` | `channelListData.presence_channel` | Per-client presence channel, sent in `channelDetail` and subscribed after the first send. |

`getLocalStorage` / `setLocalStorage` (`utils/utilities.js`) prefix every key with sessionStorage `widgetToken`, so `k_clientId` is really stored as `<fullWidgetToken>_k_clientId`. That is why `getAllChannels` can read `` `${widgetId}_k_clientId` `` with raw `localStorage.getItem`: it is the anonymous user's namespaced key, and `` `${widgetId}_${lastUniqueId}_k_clientId` `` is the last logged-in user's key. `setLocalStorage` of `k_clientId` / `a_clientId` / `WidgetId` also posts `setDataInLocal` to the host and fires a `localstorage-updated` window event (picked up by `useHelloLocalStorageEventHandlers`).

How a client is registered (`initializeHelloServices` in `components/Chatbot/hooks/useHelloEffects.ts`):

1. No `a_clientId`, no `k_clientId`, no `unique_id` / `mail` / `number` → `registerAnonymousUser()` → stores `a_clientId`.
2. Otherwise → `getAllChannels()`; the server resolves or creates the client and returns `uuid`, which is stored as `k_clientId` (identified, or already known) or `a_clientId` (anonymous with only `a_clientId`).
3. An anonymous client becomes known on its first send: `sendMessageToHelloApi` stores `response.data.data.uuid` as `k_clientId` whenever `channelDetail` was sent.
4. A socket `update` event with `client_id` replaces the stored id and re-subscribes the client channel.

Login / logout merge (`getAllChannels`): the widget remembers `` `${widgetId}_last_unique_id` `` (raw localStorage key).
- Logged out (no `unique_id`) and a last user exists → sends that user's uuid as `anon_client_uuid`.
- First login (`unique_id`, no last id) → sends the anonymous `k`/`a` client id as `anon_client_uuid` so the logged-out chat merges into the account.
- On a login response it writes `last_unique_id` and copies `uuid` to the widget-level `_k_clientId` and `_a_clientId` keys.
- `SHUTDOWN_CHATBOT` from the host clears all of these keys.

> [!WARNING]
> `getIsAnonValue()` and every `is_anon` field are dead: `is_anon` was removed from every API in e008ba8 ("remove is_anon from every API"); the commented lines are left in place. Do not re-add it.

> [!WARNING]
> `customer_name` from `/pubnub-channels/list/` is a generated pseudo name unless `pseudo_name === false`. Only then treat it as the user's name (f20ea1d). Both `getAllChannels` and `useFetchChannels` apply this check; copy it if you read `customer_name` elsewhere.

## Boot sequence

`initializeHelloServices(widgetToken)` runs when `draftData.chatSessionId` changes. It returns early unless the token equals localStorage `WidgetId` (a duplicate-init guard). Order matters:

1. `getRoutingRegion()` — **must be first**. Sets region URLs; if they changed, `socketManager.reconnect()`. Failure is non-fatal (env defaults apply).
2. `initializeHelloChat()` → `/widget-info/` → `setWidgetInfo`. Posts `hide_widget`, `launch_widget`, `setDataInLocal` to the host; on `null` posts `initializeHelloChat_failed`. Applies `primary_color` unless the host set `sdkConfig.customTheme`. With ≤1 team, sets `currentTeamId`.
3. Register or resolve the client (above). Emits `uuid` to the host (used for co-browse).
4. `getJwtToken()` → `setJwtToken` → `useSocket` connects.
5. `getGreetingQuestions` when `bot_type` is `lex` (POST) or `chatgpt` (GET); emits `SHOW_STARTER_QUESTION` when there is no real channel yet.
6. `getAgentTeamApi()` → `setAgentTeams` (id → name maps).
7. If `widgetInfo.voice_call_widget`: `getClientToken()` then `helloVoiceService.initialize()`; if `appInfo.callToken` survives from before a reload, `rejoinCall(callToken)`.
8. Anonymous path only: `fetchChannels()`.
9. Extra host `helloConfig` keys (minus a fixed deny list in the function) → `saveClientDetails` (`PUT /v2/client/<clientId>`). Sets `showWidgetForm` from whether Name/Email/Phonenumber came back.
10. Emits `ENABLE_DOMAIN_TRACKING`.

Why routing-region first: every endpoint except `/routing-region/` is region-locked, and any regional host answers `/routing-region/` for any company. The region is held in memory only, never persisted, because it is re-fetched on every mount and persisting could only make it stale (docs/brainstorms/region-wise-routing-requirements.md).

## Channels (tickets)

A **channel** is one conversation (ticket) between the client and the company. The channel id string (`channel`) is also the socket room and the `subThreadId` the chat UI renders. `id` is the numeric `chat_id`.

- **List:** `getAllChannels` → `ChannelListData`; `setChannelListData` sorts closed channels last and sets `Channel` to the first. A placeholder entry with `id: null` means "no conversation yet".
- **Create:** there is no create call. The first `sendMessageToHelloApi` with no `chat_id` sends `channelDetail` (`new: true`, `uuid`, `unique_id`, `presence_channel`, `team_id`, `channel_hex`). `channel_hex` is a client-proposed id from `generateChannelId(companyId)`; the server may honour it or return a different `channel`.
- **Selection** lives in `appInfo[tabSessionId]`: `currentChannelId`, `currentChatId`, `currentTeamId`, `overrideChannelId`, `subThreadId` (per tab, sessionStorage-persisted).
- **Assignment:** `Channel.assigned_type` is `bot`, `team` or an agent type; `assigned_id` is the id. Socket `assign` → `changeChannelAssigned`, which sets `assigned_to.name` from `agent_teams.teams` or `agent_teams.agents`. `assigned_type === 'bot'` (or unset) makes the UI show a loading state until a reply arrives (10 s cap, `useHelloTimeout`).
- **Peer channels** (`is_peer_channel`, widget-to-widget): no calling; can be blocked (`is_blocked`, socket `block`).

```ts
// Channel (types/hello/HelloReduxType.ts), trimmed
{ id: number; channel: string; team_id: string|null; assigned_type: string; assigned_id: number;
  assigned_to: string|null; is_closed: boolean; widget_unread_count: number;
  last_message: { message, timetoken }; is_peer_channel?: boolean; is_blocked?: boolean }
```

## Sending a message

`useOnSendHello` (`components/Chatbot/hooks/useHelloIntegration.ts`) is the single send path. `useSendMessageToHello` (text field, interactive buttons, Apple replies) and `CallButton` call it.

1. Empty text and no images → no-op (unless `voiceCall`).
2. New chat (no chat id and no channel id, or `forceNewChat`) → `generateChannelId`, set `subThreadId`, move messages out of a `notification-…` thread.
3. Append the optimistic user message (with reply metadata) to the thread.
4. New chat → **subscribe to the proposed channel before sending**, raced against `PRE_SUBSCRIBE_TIMEOUT_MS` (2 s).
5. `sendMessageToHelloApi` → `POST /v2/send/`.
6. On a new chat: set `currentChannelId`/`currentChatId` from the response; `markPreSubscribed` if the server kept the proposed id; else unsubscribe it and `moveThreadMessages` to the real id; `fetchChannels()`; subscribe `[presence_channel, channel]`.

> [!WARNING]
> Pre-subscribe exists because a bot reply can arrive before `/v2/send/` returns, and it went to a channel nobody had joined (5e53fff). `consumePreSubscribed` then makes `useHelloEffects` skip one history fetch, because `setInitialMessages` replaces the thread and would erase the reply the socket already delivered. Keep the `markPreSubscribed` call before the `setDataInAppInfoReducer` dispatch: that dispatch triggers the history effect.

> [!WARNING]
> `socketManager.subscribe` queues forever while the socket is down. Always race it with a timeout on a user-facing path, as `useOnSendHello` does.

Demo widgets (`widgetInfo.demo_widget`) send `type: "trial_bot"` with `bot_id`, `bot_type`, `session_id` and the last 5 raw messages as `conversations`, and skip channel listing.

Widget merge: when sessionStorage `helloConfig` has both `flow_origin` and `integration`, `getMergeParams()` adds them to `/pubnub-channels/list/` and `channelDetail`, and `CallButton` hides (df2f79a).

## Calls we make

Summary only; [api](../api.md) owns the full table.

| Function | Endpoint | Key response fields |
|---|---|---|
| `getRoutingRegion` | `POST /routing-region/` | `region_url`, `socket_url` |
| `initializeHelloChat` | `POST /widget-info/` | `company_id`, `bot_id`, `bot_type`, `inbox_id`, `teams`, `event_channels`, `voice_call_widget`, `primary_color`, `hide_launcher`, `launch_widget`, `show_widget_form`, `demo_widget`, `feedback_text`, `logo` |
| `registerAnonymousUser` | `POST /anonymous-client-details/` | `data.uuid` → `a_clientId` |
| `getAllChannels` | `POST /pubnub-channels/list/` | `uuid`, `channels[]`, `presence_channel`, `customer_name`, `customer_mail`, `customer_number`, `pseudo_name` (top level, not under `data`) |
| `getJwtToken` | `GET /jwt-token/` | `data.jwt_token` (socket auth) |
| `getAgentTeamApi` | `POST /agent-team/` | `agents[]`, `teams[]` |
| `getGreetingQuestions` | `POST /chat-bot/welcome/get-welcome/` (lex) or `GET /chat-gpt/greeting/` | `data.greeting.{text, options}` |
| `saveClientDetails` | `PUT /v2/client/<clientId>` | `data` (Name, Email, Phonenumber) |
| `getHelloChatHistoryApi` | `POST /get-history/` (`page_size` 30, `start_from` = skip+1) | `data.data[]` messages |
| `getFullMessageApi` | `POST /get-history/` with `message_id` | full text of a truncated message |
| `sendMessageToHelloApi` | `POST /v2/send/` | `data.{id, channel, presence_channel, uuid, call_jwt_token, session_id}` |
| `uploadAttachmentToHello` | `POST /v2/upload/?type=chat&inbox_id=…` | upload result |
| `deleteReadReceipt` | `DELETE /read-receipt/<channelId>` | — |
| `submitFeedback` | `POST /receive-feedback/` (`type: "post-feedback"`) | — |
| `getClientToken` | `GET /web-rtc/get-client-token/` | `data.jwt_token` → `HelloClientToken` |
| `getCallToken` | `GET /web-rtc/get-call-token/` | unused (call commented out in `useHelloEffects`) |
| `addDomainToHello` | `PUT /add-domain/` | page/domain tracking from the host |
| `subscribeForFCMPushNotification` | `POST <PUSH_NOTIFICATION_URL>/add-user-fcm-token/` | the only function that rethrows |

Every body also carries `user_data: getUserData()` (localStorage `userData` minus `name` and empty values).

## Response shapes that bite

- `/pubnub-channels/list/` returns its fields at `response.data` (no `data.data`), unlike most calls, which return `response.data.data`.
- `getAllChannels` returns `[]` on error, not an object; callers read `response?.channels`.
- `sendMessageToHelloApi` returns `null` on error and the optimistic message stays in the thread.
- `/v2/send/` session id: `extractSessionId` (`utils/utilities.js`) reads only `session_id`; the backend field name is not confirmed (comment in code).

## Realtime (socket.io)

- **Connect:** `useSocket` calls `socketManager.connect(jwt)` when `Hello[chatSessionId].socketJwt.jwt` is set. The URL is read at connect time from `getSocketUrl()`.
- **Subscriptions:** `ch-comp-<company_id>-<clientId>` (client channel), every `channelListData.channels[].channel`, and every `widgetInfo.event_channels` entry. Emitted as `subscribe` / `unsubscribe` with `{ channel: [...] }`. On `connect` all tracked channels are re-subscribed.
- **Inbound events** (`useSocketEvents` in `hooks/socketEventHandler.ts`): `NewPublish` with `response.message.type`:

| `type` | Effect |
|---|---|
| `chat` | New message. Others' messages: append, stop loading, sound, clear typing, reopen a closed channel. Own message (`chat_id` and matching or absent `client_sender_id`): `updateHelloMessage`. `message_type: 'voice_call'` with status `completed` / `no_answer` / `in-progress` appends a call log; `completed` emits `call-completed` → history refetch. |
| `feedback` | Append the feedback card, mark the channel closed. |
| `assign` | `changeChannelAssigned`. |
| `block` | `setChannelBlockedStatus` (peer channels). |
| `new-channel` | `addChannel`, subscribe it, then `fetchChannels()` to hydrate missing fields. |
| `update` | Client id changed: store `client_id`, re-subscribe `ch-comp-<company_id>-<client_id>`. |

  `Typing` with `action` `typing` / `not-typing` → `setTyping`. Outbound typing goes through `useTypingStatus` on the `event_channels` entry that contains `typing`.
- **Reconnect:** `socketManager.onReconnect` callback refetches history for the current channel (6b18085). Region change: `socketManager.reconnect()` rebuilds the transport but keeps channels and queued callbacks.

> [!WARNING]
> `useHelloEffects` clears **all** reconnection callbacks on cleanup (`socketManager.reconnectionCallbacks = []`). Registering your own `onReconnect` elsewhere will be wiped when that effect re-runs.

> [!WARNING]
> In peer channels the other side's messages also carry `chat_id`, so `chat_id` alone does not mean "mine". Use the `isOwnMessage` rule (`client_sender_id` vs the stored client id).

## Unread counts

- Per channel: `Channel.widget_unread_count`. Socket `chat`/`feedback` from others → `setUnReadCount` (+1) and `moveChannelToTop`.
- Reset: `useHelloEffects` debounces 1 s, then calls `deleteReadReceipt(channelId)` and `setUnReadCount({ resetCount: true })` only when the widget is open, not minimized, the tab is visible, and (on small screens) the drawer is closed.
- Badge: total of `widget_unread_count` + unread notifications → `SET_BADGE_COUNT` to the host (`'99+'` cap, `channelId: '*'`); `setUnReadCount` also emits a per-channel `SET_BADGE_COUNT`. Host can ask with `GET_TICKET_UNREAD_COUNT`.

> [!WARNING]
> The `Hello` slice is persisted to localStorage and synced across tabs (`store/index.js` `crossTabSyncConfig`), **except** `Hello/setUnReadCount` increments. Every tab receives the socket event itself; syncing the increment would count each message once per open tab.

## Feedback, interactive and Apple messages

- **Feedback** (`RenderHelloFeedbackMessage`): ratings `terrible|bad|ok|good|amazing` + text → `submitFeedback({ feedbackMsg, rating, token, id })` with `token` and `id` from the message. On success it writes `rating`/`feedback_msg` back with `updateHelloMessage` so it survives a channel switch (d9adbae). Header text is `widgetInfo.feedback_text` with `##key##` placeholders filled from `message.dynamic_values`.
- **Interactive** (`RenderHelloInteractiveMessage`): switches on `messageJson.type || messageJson.category || message.message_type`: `button`, `quick_reply`, `cta_url`, `list`, `carousel`, `product`, `product_list`, `location_request`. Button clicks call `useSendMessageToHello` with the button title and reply metadata (`replied_msg_type: interactive`). Greeting messages (`type === 'greeting_msg'`) send no reply metadata (eb41abe).
- **Apple** (`AppleInteractiveMessage`): checked first. Structure:
  - Detection helpers (exported): `detectAppleInteractiveType`, `getAppleInteractiveData`, `getAppleFeatureData`, `isSelfContainedAppleMessage` (used by `HumanOrBotMessage` to drop the outer bubble), `getAppleInteractivePreviewText` (used by `ChatbotDrawer` for last-message previews).
  - Types: `APPLE_INTERACTIVE_TYPES` (quick reply, list picker, time picker, rich link, form, authenticate, Apple Pay, custom). Payloads arrive nested (`interactiveData.data`), flattened, or tagged with snake_case aliases (`TYPE_ALIASES`).
  - Renderers: `AppleInteractiveMessageBody` switch → `ListPickerBubble`, `TimePickerBubble`, `FormBubble`, `RichLinkCard`, `AppleBubble`, `AppleSheet`. A choice is sent back as plain text via `sendMessageToHello`, then the bubble swaps to `replyMessage`.
  - Authenticate and Apple Pay are display-only ("can only be completed inside Apple Messages").

> [!WARNING]
> `RichLinkCard` unfurls links through the public `api.microlink.io` API (a third party sees the URL) and caches results in localStorage under `hello_link_preview:`. Failures fall back silently.

> [!WARNING]
> Replies to Apple messages: Apple payloads have no `category`, so `useOnSendHello` detects an interactive reply with `message_type === MESSAGE_TYPES.INTERACTIVE` too (9c25ac4). `quick_reply` is shared with the WhatsApp shape; Apple claims it only when Apple structure is present.

## Voice calling (msg91-webrtc-call)

- Enabled by `widgetInfo.voice_call_widget`. `CallButton` also hides for non-Hello widgets, peer channels and merged widgets, and is disabled unless `callState === 'idle'`.
- Init: `getClientToken()` stores `HelloClientToken`; `helloVoiceService.initialize()` calls `WebRTC(clientToken, env)` and listens for `call`.
- Outgoing: `CallButton` asks for the microphone, then `useOnSendHello({ voiceCall: true })` (`message_type: 'voice_call'`), then `helloVoiceService.initiateCall(data.call_jwt_token)`. The call token comes from `/v2/send/`, not `getCallToken`.
- Incoming (Agent → client, c5affbb): `handleCall` with `call.type === 'incoming-call'` posts `OPEN_CHATBOT` to the host so the Accept button is visible. Outgoing call objects that arrive while the tab is hidden are ignored.
- State: `idle` → `ringing` → `connected` → back to `idle` (`resetCall`); `rejoined` after a reload. `useCallUI` stores the connected call id as `appInfo.callToken` (sessionStorage-persisted per tab) and clears it on `idle`; boot calls `rejoinCall(callToken)` when it is set.
- `CallUI` (`components/Hello/callUI.tsx`) plays the remote `mediaStream` in an `<audio>` element.

> [!WARNING]
> `HelloVoiceService.ts` maps `?env=stage` to WebRTC environment `'prod'` and everything else to `'test'` (1b52a96). It looks inverted, but it is the shipped behaviour; confirm with the MSG91 WebRTC team before "fixing" it.

> [!TODO] Needs a human: why does `?env=stage` select the `prod` WebRTC environment and production select `test`?

"Video call" messages (`RenderHelloVedioCallMessage`) are only a meeting URL with `expiration_time`; there is no in-widget video.

## Redux shape

`state.Hello[chatSessionId]` (`types/hello/HelloReduxType.ts`, reducers in `store/hello/helloReducer.ts`). Every reducer reads `action.urlData.chatSessionId` (attached by the store middleware), not the payload.

```ts
{
  widgetInfo,            // /widget-info/ response, plus runtime overrides (tagline, show_widget_form, fullScreen)
  helloConfig,           // host helloData payload (HelloData)
  channelListData,       // /pubnub-channels/list/ response (ChannelListData)
  Channel,               // first channel after sort
  socketJwt: { jwt },    // /jwt-token/
  greeting, agent_teams: { teams: {id: name}, agents: {id: name} },
  showWidgetForm, clientInfo: { Name, Email, Phonenumber },
  // GTWY bridge fields from getHelloDetailsSuccess: anonymousClientId, mode, vision
}
```

`show_widget_form` precedence: `helloConfig.show_widget_form`, then `widgetInfo.show_widget_form`, then the heuristic `showWidgetForm` (true unless real name, mail and number are known).

## When it fails

- `/routing-region/` fails → env default host; init continues.
- `/widget-info/` returns `null` → `initializeHelloChat_failed` to the host; JWT, greeting and call setup are skipped (they require `widgetData`), so no socket.
- Any other call → toast + `null`/`[]`; no retry anywhere. History reloads on socket reconnect and on channel change.
- Send fails → loading clears after 10 s (`useHelloTimeout`), the pre-subscription is dropped, the optimistic message stays.

## How to change safely

- New Hello endpoint: add it to `config/helloApi.ts`, build the URL with `HELLO_HOST_URL()` (never cache the host), send `authorization: getAuthorization()` and `user_data: getUserData()`, keep the toast-and-return-null pattern, then add it to [api](../api.md).
- Never call `/widget-info/` or any other Hello endpoint before `getRoutingRegion()` resolves in the boot sequence.
- Read/write client ids only with `getLocalStorage` / `setLocalStorage`, so the widget-token prefix and host sync apply. The raw `localStorage` keys in `getAllChannels` and `handleShutdownChatbot` must stay in step with each other.
- New socket event: add a `case` in `useSocketEvents`, check `message.new_event`, and dispatch a `Hello` reducer that takes `channelId` in the payload.
- New message renderer: wire it in `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx` (see [chat-ui](../modules/chat-ui.md)); send replies through `useSendMessageToHello`, never `sendMessageToHelloApi` directly, so new-channel and pre-subscribe logic run.
- Call changes stay inside `helloVoiceService` / `useCallUI`; do not add a second call-state source.

Related: [embed-scripts](../modules/embed-scripts.md), [chat-ui](../modules/chat-ui.md), [ai-chat](../modules/ai-chat.md), [hello-human-chat](../flows/hello-human-chat.md), [api](../api.md), [environment](../environment.md).
