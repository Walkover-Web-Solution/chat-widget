---
covers: ["config/helloApi.ts", "config/regionConfig.ts", "utils/helloInterceptor.ts", "components/Chatbot/Chatbot.tsx", "components/Chatbot/hooks/useHelloIntegration.ts", "components/Chatbot/hooks/useHelloEffects.ts", "components/Chatbot/hooks/useChatActions.ts", "components/Chatbot/hooks/useColor.ts", "components/Chatbot/hooks/useReduxEffects.ts", "components/Chatbot/hooks/useReduxManagement.ts", "components/Chatbot/hooks/useScreenSize.ts", "components/Chatbot/hooks/useTabData.ts", "components/Chatbot/hooks/useTabVisibility.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# MSG91 Hello API

MSG91 Hello is the chat backend: widget config, client identity, channels, history, sending, uploads, feedback and WebRTC tokens. Every REST call lives in `config/helloApi.ts`. The `Chatbot` container (`components/Chatbot/Chatbot.tsx`) and its hooks decide when each call runs.

> [!WARNING]
> Every function in `config/helloApi.ts` catches its own errors, shows an `errorToast` and returns `null` or `[]`. A caller's `.catch` never fires for an HTTP error, and "failed" looks the same as "empty". Check the return value. Example: `components/FormComponent.tsx` closes the form even when `saveClientDetails` failed. Exceptions: `subscribeForFCMPushNotification` rethrows, `addDomainToHello` fails silently, `getRoutingRegion` only logs.

## Connection

- **Base URL:** `config/regionConfig.ts:getHelloHostUrl`, resolved on every call (see [Region routing](#region-routing)). The default is `NEXT_PUBLIC_MSG91_HOST_URL`. The push host is `NEXT_PUBLIC_PUSH_NOTIFICATION_URL` and is not region-routed. Env var details live in [environment](../environment.md).
- **Client:** the axios instance in `utils/helloInterceptor.ts`. It has a pass-through response interceptor only; the old "client no longer exists" reset handler is commented out. No base URL, timeout or retry is set on it.
- **Auth:** an `authorization` header built from local storage. There are no cookies and no bearer prefix. The header takes three forms:

| Form | Built by | Used for |
|---|---|---|
| `<WidgetId>` | `getLocalStorage('WidgetId')` | `routing-region`, `widget-info`, `anonymous-client-details` |
| `<WidgetId>:<clientId>` | `config/helloApi.ts:getAuthorization` (clientId = `k_clientId` or `a_clientId`) | everything else |
| `<WidgetId>:<clientId>` or `<WidgetId>` | inline in `getAllChannels` and `getGreetingQuestions` | the two calls that may run before a client id exists |

> [!WARNING]
> `getAuthorization` does not fall back. With no client id it sends `<WidgetId>:null`. Only `getAllChannels` and `getGreetingQuestions` drop to the bare widget id. Before 2026-10-14, a blocked iframe storage in iOS WhatsApp/Instagram WebViews made every header `null:null` and every call 401. `utils/safeStorage.ts` now mirrors writes in memory (commit 25f0b11, after an earlier attempt was reverted in 542cc80).

## Calls we make

All paths are relative to the region host. `user_data` is `config/helloApi.ts:getUserData`: the stored `userData` without `name` and without falsy values (so `unique_id`, `mail`, `number`, `user_jwt_token`).

| Function | Endpoint | Auth | Returns / caller reads |
|---|---|---|---|
| `getRoutingRegion` | `POST /routing-region/` body `{user_data}` | `WidgetId` | `response.data`: `region_url`, `socket_url` (fed to `setRegionUrls`). Returns `null` on error |
| `initializeHelloChat` | `POST /widget-info/` body `{user_data}` | `WidgetId` | `response.data` = widgetInfo: `company_id`, `bot_id`, `bot_type`, `teams`, `primary_color`, `voice_call_widget`, `hide_launcher`, `launch_widget`, `demo_widget`, `show_widget_form` |
| `registerAnonymousUser` | `POST /anonymous-client-details/` body `{}` | `WidgetId` | `response.data.data`; writes `data.uuid` to `a_clientId` |
| `getAllChannels` | `POST /pubnub-channels/list/` | `WidgetId[:k or a clientId]` | `response.data` (shape below), or `[]` on any error, so failure looks like "no chats"; writes client ids (see [Identity model](#identity-model)) |
| `getJwtToken` | `GET /jwt-token/` | `getAuthorization` | `response.data.data.jwt_token`; also stored as `JwtTokenForSocket`. The caller puts it in Redux with `setJwtToken`; the chat and notification sockets connect with it |
| `getAgentTeamApi` | `POST /agent-team/` body `{user_data}` | `getAuthorization` | `response.data` → `setAgentTeams` (`teams`, `agents` maps) |
| `getGreetingQuestions` | `bot_type === 'lex'`: `POST /chat-bot/welcome/get-welcome/` body `{company_id, bot_id}`; otherwise `GET /chat-gpt/greeting/?company_id&bot_id` | `WidgetId[:clientId]` | `response.data.data`; caller reads `greeting.text`, `greeting.options` |
| `saveClientDetails` | `PUT /v2/client/<clientId>` body `{...clientData, user_data}` | `getAuthorization` | `response.data.data`; caller reads `Name`, `Email`, `Phonenumber`. Returns `null` without a network call when there is no client id |
| `getHelloChatHistoryApi` | `POST /get-history/` body `{channel, origin:"chat", page_size: PAGE_SIZE.hello, start_from: skip+1, user_data}` | `getAuthorization` | `response.data`; the message array is at `response.data.data` |
| `getFullMessageApi` | `POST /get-history/` body `{channel, message_id, origin:"chat", user_data}` | `getAuthorization` | full text of a truncated (`show_more`) message via `utils/readMore.ts:extractFullMessageText`; used by `components/Interface-Chatbot/Messages/ReadMoreText.tsx` |
| `sendMessageToHelloApi` | `POST /v2/send/` (body below) | `getAuthorization` | `response.data.data`: `channel`, `id` (chat id), `presence_channel`, `uuid`, `call_jwt_token`, `session_id` (demo) |
| `uploadAttachmentToHello` | `POST /v2/upload/?type=chat&inbox_id=<id>` multipart field `attachment` | `getAuthorization` | `response.data`; used by `components/Interface-Chatbot/ChatbotTextField.tsx` |
| `getClientToken` | `GET /web-rtc/get-client-token/` | `getAuthorization` | `response.data.data`; `jwt_token` stored as `HelloClientToken`, read by `components/Chatbot/hooks/HelloVoiceService.ts` |
| `getCallToken` | `GET /web-rtc/get-call-token/?channel=<id>` | `getAuthorization` | stores `HelloCallToken` when no channel is given. No caller today: calls get their token from `call_jwt_token` in the send response |
| `addDomainToHello` | `PUT /add-domain/` body `{dom, user_data, event_data}` | `getAuthorization` | domain tracking and custom events from the host page (`hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`) |
| `deleteReadReceipt` | `DELETE /read-receipt/<channelId>` | `getAuthorization` | marks the channel read; called by `useHelloEffects` after a 1 s debounce when the chat is open, visible and not minimized |
| `submitFeedback` | `POST /receive-feedback/` body `{feedback_msg, rating, token, type:"post-feedback", id, user_data}` | `getAuthorization` | used by `components/Hello/RenderHelloFeedbackMessage.tsx` |
| `subscribeForFCMPushNotification` | `POST <NEXT_PUBLIC_PUSH_NOTIFICATION_URL>/add-user-fcm-token/` body = `pushConfig` + `user_channel` | the socket JWT passed by the caller | mobile SDK only; called from `hooks/notifications/notificationSocket.ts` |

Helpers that make no request: `getAuthorization`, `getUserData`, `getIsAnonValue` (true only when `a_clientId` is set and `k_clientId` is not), and `getMergeParams`. `getMergeParams` returns `{flow_origin, integration}` from the session `helloConfig` only when both are set ("widget merge"). It is spread into the list and send bodies, and `components/Interface-Chatbot/CallButton.tsx` and `components/Interface-Chatbot/ChatbotDrawer.tsx` use it to hide calling.

### Send body

```ts
// POST /v2/send/ (config/helloApi.ts:sendMessageToHelloApi)
{
  type: "widget" | "trial_bot",            // trial_bot when widgetInfo.demo_widget
  widget_msg_id: string,                   // local message id, "" if none
  message_type: "text" | "voice_call" | "attachment" | "text-attachment",
  content: { text, attachment },
  chat_id: number | null,
  channelDetail?: {                        // only for a new chat (no chat_id) or a demo widget
    uuid, unique_id, presence_channel, team_id,
    customer_name, customer_number, customer_mail, pseudo_name,  // from Redux clientInfo
    new: true, channel_hex,                // channel id proposed by the client
    flow_origin?, integration?             // getMergeParams()
  },
  replied_on?: string,
  trial_company_id?, bot_id?, bot_type?, session_id?, conversations?,  // demo widget only
  user_data, sessionVariables              // sessionVariables = draftData.hello.variables
}
```

### List response (`getAllChannels`)

```ts
// typed as ChannelListData in types/hello/HelloReduxType.ts
{ uuid, unique_id, presence_channel, pseudo_name: boolean,
  customer_name, customer_number, customer_mail,
  channels: [{ id, channel, team_id, assigned_type, widget_unread_count, is_peer_channel?, last_message, ... }] }
```

## Response shapes that bite

- **`customer_name` is fake unless `pseudo_name === false`.** The backend makes up a name for anonymous clients. `getAllChannels` and `useFetchChannels` only treat it as real when `pseudo_name` is strictly `false` (commit f20ea1d). Without this check the widget form was hidden for users who never gave a name.
- **A list with no real chats still has one channel.** "No chats yet" is `channels.length === 0` or a single channel with `id === null`. That test appears in `useHelloEffects` (starter question), in `components/Chatbot/hooks/useReduxManagement.ts:isDefaultNavigateToChatScreenFn`, and after the first send (`HIDE_STARTER_QUESTION`).
- **History is one level deeper than you expect.** The array is at `response.data.data` of the axios response, so `getHelloChatHistoryApi(...)` gives you `.data.data`. Pages are `PAGE_SIZE.hello` (30) messages long; `hasMoreMessages` is "page came back full". `start_from` is 1-based (`skip + 1`).
- **The server may ignore the channel id the client proposes.** `channel_hex` is generated by `utils/utilities.js:generateChannelId` (`ch-comp-<companyId>.<uuid>`). `useOnSendHello` always uses `data.channel` from the response and moves the thread if the id differs.
- **Partial list responses must not wipe client info.** `useFetchChannels` drops `undefined` fields (`JSON.parse(JSON.stringify(...))`) before `setHelloClientInfo` (commit 7508e47).
- **`saveClientDetails` body order matters.** `user_data` comes last so `clientData` cannot overwrite it. It was briefly merged into `user_data` (1211258) and changed back (4138bc4).
- **Write-only key:** `getAllChannels` writes customer details to the local key `client`. Nothing reads it.

## Region routing

Each company lives on one regional Hello backend. `POST /routing-region/` can be answered by any region and returns that company's `region_url` and `socket_url`. Every other endpoint, `widget-info` included, only works on the right region. The decision record is `docs/brainstorms/region-wise-routing-requirements.md` (commits a3cbac3, c6ea9c1).

1. `config/regionConfig.ts` keeps `regionUrl` and `socketUrl` in module memory, empty at load.
2. `getHelloHostUrl` returns `regionUrl`, or the default. The default is `NEXT_PUBLIC_MSG91_HOST_URL`, but when the iframe URL has `?env=stage` it is hard-coded to `https://stageapi.phone91.com`. `getSocketUrl` does the same with `NEXT_PUBLIC_SOCKET_URL` and `https://stagechat.phone91.com`.
3. `getRoutingRegion` is step 0 of `initializeHelloServices`. It calls `setRegionUrls`, and if either URL changed it calls `socketManager.reconnect()`. That rebuilds the socket against the new region and keeps queued subscriptions; the first version called `disconnect()` and lost them (c6ea9c1). See [realtime](../modules/realtime.md).
4. `helloApi.ts` reads the host through `HELLO_HOST_URL()` on each call, and `hooks/socketManager.js` reads `getSocketUrl()` at connect time, so a region that arrives late applies to everything after it.

Why it is not persisted: routing-region runs on every mount (reload and new tab included), so a stored region could only be stale. Persisting in localStorage was the original ask and was rejected in the brainstorm. A routing-region failure is not fatal; calls go to the env defaults.

> [!WARNING]
> Do not call any Hello endpoint before `getRoutingRegion` has resolved, and never cache `getHelloHostUrl()` in a module constant. Before a3cbac3 the host was a constant read at import time, which pinned every company to one region. The `?env=stage` check reads `window.location.search` once, at module load.

> [!TODO] Needs a human: `getRoutingRegion` has a leftover debug `console.log` of the widget id. Is it safe to remove?

## Identity model

The host page sends `widgetToken` plus optional `unique_id`, `mail`, `number`, `name` and `user_jwt_token` in the `helloData` event. `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` stores them as local `userData` and `WidgetId`, and sets the session key `widgetToken` to `<widgetToken>_<unique_id>` (or `<widgetToken>` when there is no `unique_id`). See [app shell](../modules/app-shell.md).

| Term | Meaning |
|---|---|
| `WidgetId` | the widget token; the first part of every `authorization` header |
| `a_clientId` | Hello client uuid of an anonymous visitor who has not sent a message yet. Set by `registerAnonymousUser` |
| `k_clientId` | Hello client uuid of a known user (`unique_id`, `mail` or `number`), or of an anonymous visitor after their first send. `sendMessageToHelloApi` writes `k_clientId` whenever it sent a `channelDetail` |
| `uuid` | the same client uuid as the server returns it (`channelListData.uuid`, list and send responses) |
| `unique_id` | the host app's own user id; makes the user "known" and namespaces their storage |

> [!WARNING]
> `utils/utilities.js:getLocalStorage` and `setLocalStorage` prefix every key with the session `widgetToken`. So `getLocalStorage('k_clientId')` reads `<widget>_<unique_id>_k_clientId` for a logged-in user and `<widget>_k_clientId` for a logged-out one. `getAllChannels` crosses these namespaces on purpose with raw `safeLocalStorage` keys. Do not "simplify" those raw keys to `getLocalStorage`.

How `getAllChannels` merges anonymous and known chats (commit 059ee14). The raw keys are `<widget>_last_unique_id`, `<widget>_k_clientId`, `<widget>_a_clientId` and `<widget>_<unique_id>_k_clientId`.

1. **First login** (`unique_id` set, no `last_unique_id`): send `anon_client_uuid` = the logged-out `k_clientId` or `a_clientId`, so the server merges the anonymous chats into the user.
2. **Logout** (no `unique_id`, `last_unique_id` present): send `anon_client_uuid` = the last logged-in user's `k_clientId`.
3. **After a known-user response:** record `last_unique_id`, and copy the returned uuid into both logged-out keys and `k_clientId`. An anonymous response writes `a_clientId`.
4. `handleShutdownChatbot` (the host's shutdown call) clears all of these keys, so the next visitor starts clean.

Other stored values: `JwtTokenForSocket`, `HelloClientToken`, `HelloCallToken` (local, prefixed) and `userData`. `setLocalStorage` also sends `k_clientId` and `a_clientId` to the host page as `hello-widget-uuid` and `hello-widget-anonymoud-uuid` (sic). A socket `update` event can replace the client id (`hooks/socketEventHandler.ts`).

`is_anon` was once sent on every call and was removed (7c05d7a, e008ba8). It caused unauthorized errors when the stored flag disagreed with the client id. The commented-out `is_anon` lines are leftovers; the server works it out from the header.

## Init sequence

`useHelloEffects` runs `initializeHelloServices` when `draftData.chatSessionId` changes. It takes the widget token as `chatSessionId.split('_')[0]` and stops unless that equals `WidgetId` (this also blocks duplicate runs). The full flow is in [widget boot](../flows/widget-boot.md).

1. `getRoutingRegion`.
2. `initializeHelloChat` → `setWidgetInfo`, theme (unless the SDK passed `customTheme`), parent messages `hide_widget`, `setDataInLocal`, `launch_widget`; auto-select the team when there is only one.
3. No client id and no `unique_id`/`mail`/`number` → `registerAnonymousUser`. Otherwise → `useFetchChannels` (list API).
4. `emitEventToParent('uuid')` for co-browse.
5. `getJwtToken` → `setJwtToken`, which lets the sockets connect.
6. `getGreetingQuestions` for `lex`/`chatgpt` bots → `SHOW_STARTER_QUESTION` if there are no chats yet.
7. `getAgentTeamApi`, not awaited.
8. If `voice_call_widget`: `getClientToken` → `helloVoiceService.initialize()`, then rejoin a call in progress. See [voice calling](../modules/voice-calling.md).
9. After an anonymous registration, fetch the channel list now.
10. Send script params (minus the keys in `keysToRemove`) through `saveClientDetails`, then `ENABLE_DOMAIN_TRACKING`.

> [!WARNING]
> `initializeHelloChat` returns `null` on failure and never throws, so the `catch` that "returns early" in step 2 is unreachable for HTTP errors. On failure the code posts `initializeHelloChat_failed` and carries on. Registration and the list call still run; JWT, greeting and calling are skipped because they check `widgetData`.

> [!WARNING]
> `chatSessionId.split('_')[0]` assumes widget tokens never contain `_`.

Other effects in `useHelloEffects`: it fetches history when `currentChannelId` changes (once skipped for a pre-subscribed channel, see below), on socket reconnect (`socketManager.onReconnect`) and on voice `call-completed`. It also posts the badge count (`SET_BADGE_COUNT`, capped at `99+`), clears the reply on channel change, and resets thread ids when the demo bot changes.

## Sending

`useSendMessageToHello` builds the local message (24-char id, which becomes `widget_msg_id`) and calls `useOnSendHello`. The full flow is in [send message](../flows/send-message.md).

- **New chat** (no chat id and no channel id): generate a `channel_hex`, subscribe to it **before** sending, and give up after `PRE_SUBSCRIBE_TIMEOUT_MS` (2 s) so a dead socket delays the send instead of blocking it (commit 5e53fff). A bot reply can arrive before the send response; without the early subscribe it went to a channel nobody was listening on.
- If the server keeps the proposed id, the channel is recorded with `utils/preSubscribedChannels.ts:markPreSubscribed` before the dispatch that sets `currentChannelId`. The history effect then skips one fetch, because `setInitialMessages` replaces the thread and would erase a socket reply that already arrived.
- If the server returns another channel, unsubscribe the proposed one; otherwise it is revived on every reconnect.
- After a send that creates a channel: set `currentChatId`/`currentChannelId`, refetch the list (not for demo widgets), and subscribe to `presence_channel` and `channel`.
- A widget form shows on a new chat when `show_widget_form` is on. Precedence: script `helloConfig` → `widgetInfo` → the client-details heuristic. The same rule is in `components/Chatbot/Chatbot.tsx`.
- **Demo widget** (`widgetInfo.demo_widget`): `type: "trial_bot"`, the `channelDetail` is always sent, and `session_id` is reused only while the chat it came with is current. The last 5 raw messages go as `conversations`.
- `forceNewChat` (initial or prefill message from the host) blanks the channel, chat and team.

## Container and small hooks

| File | Role |
|---|---|
| `components/Chatbot/Chatbot.tsx` | layout: drawer, header, progress bar, widget form, `CallUI`, notification page, empty or active chat. Mounts `useHelloEffects` and `useReduxEffects`. Wrapped in `hoc/addUrlDataHoc.tsx`, which injects `chatSessionId` and `tabSessionId` (`<chatSessionId>_<tab>`) |
| `components/Chatbot/hooks/useHelloIntegration.ts` | history, pagination, list, send hooks; `useHelloContext` reads `ChatContext` from `components/Chatbot-Wrapper/ChatbotWrapper.tsx` |
| `components/Chatbot/hooks/useHelloEffects.ts` | init sequence and side effects listed above; also mounts the socket hooks |
| `components/Chatbot/hooks/useReduxManagement.ts` | `useReduxStateManagement`: selectors for `uuid`, `unique_id`, `presence_channel` (from `channelListData`) and per-tab `currentChatId`/`currentChannelId`/`currentTeamId`/`overrideChannelId` |
| `components/Chatbot/hooks/useChatActions.ts` | memoized dispatchers for `Chat` slice flags |
| `components/Chatbot/hooks/useReduxEffects.ts` | copies per-tab `subThreadId` into `Chat`; opens the drawer on large screens |
| `components/Chatbot/hooks/useTabData.ts` | per-tab ids for `addUrlDataHoc` |
| `components/Chatbot/hooks/useScreenSize.ts` | `isSmallScreen` = max-width 1023px |
| `components/Chatbot/hooks/useTabVisibility.ts` | `isTabVisible` from `visibilitychange`; gates read receipts |
| `components/Chatbot/hooks/useColor.ts` | colors derived from the MUI primary color (theme lives in [components](../ui/components.md)) |

Redux keys (`Hello[chatSessionId]`, `appInfo[tabSessionId]`) are documented in [state](../ui/state.md).

## When it fails

- No retries and no timeouts anywhere. A hung request hangs its init step, because the steps are awaited in order.
- `useHelloTimeout` clears the "bot typing" loader after 10 s, whether or not a reply came.
- A failed send returns `null`. The optimistic message stays in the thread, and the early subscription is dropped.
- Error toasts show `error.response.data.message` for most calls, but `error.message` (axios text such as "Request failed with status code 500") for widget-info, send, upload and the WebRTC calls.

## Changing this safely

- **New endpoint:** add a function to `config/helloApi.ts` using `HELLO_HOST_URL()` and the shared `axios`. Pick the auth form from the table above, and include `user_data: getUserData()` as the other calls do. If it can run before a client id exists, do not use `getAuthorization`.
- **Changing an identity key:** check every reader (`hooks/socket.js`, `hooks/socketEventHandler.ts`, `hooks/coBrowser/CBManger.ts`, `hooks/notifications/notificationSocket.ts`, `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx`, `components/Interface-Chatbot/Messages/RepliedMessage.tsx`) and the shutdown handler.
- **Changing init order:** routing-region must stay first, and the JWT must come after the client id exists.
- Test with a logged-out visitor, a `unique_id` login, a logout, a second widget on the same page, `?env=stage`, and a demo widget.

> [!TODO] Needs a human: is `getCallToken` (no callers) safe to delete, or kept for the mobile SDK?
