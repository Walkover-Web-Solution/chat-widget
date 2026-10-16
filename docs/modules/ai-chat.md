---
covers: ["config/api.ts", "store/chat/**", "components/Chatbot/hooks/chatReducer.ts", "components/Chatbot/hooks/chatTypes.ts", "components/Chatbot/hooks/useChatActions.ts", "components/Chatbot/hooks/useChatEffects.ts", "components/Chatbot/hooks/useRtlayerEventManager.tsx", "components/Chatbot/hooks/useReduxEffects.ts", "components/Chatbot/hooks/useReduxManagement.ts", "hooks/GTWY/**"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# AI chat (GTWY chatbot conversation)

The conversation with a GTWY AI agent inside the widget iframe: sending a user message over HTTP, receiving the reply over **rtlayer** (not socket.io), keeping messages per sub-thread in the Redux `Chat` slice, loading history page by page, and switching sub-threads. The hooks are mounted once by `components/Chatbot/Chatbot.tsx`; the UI in [chat-ui](./chat-ui.md) reads the `Chat` slice and calls the action hooks. The socket.io files in this area are the realtime transport for [MSG91 Hello](../integrations/hello.md), not for the AI bot.

| File | Role |
|---|---|
| `config/api.ts` | Axios calls to the GTWY backends: send message, history, threads, feedback, image upload, Hello subscribe. Several exports are unused (see Gotchas). |
| `store/chat/chatReducerV2.ts` | Case reducers and `initialChatState` for the Redux `Chat` slice. The live chat state. |
| `store/chat/chatSlice.ts` | `createSlice({ name: "Chat" })` over `chatReducerV2`; exports the action creators. |
| `components/Chatbot/hooks/useChatActions.ts` | Hooks that do the work: `useSendMessage`, `useGetInitialChatHistory`, `useGetMoreChats`, `useFetchAllThreads`, `useMessageFeedback`, `useChatActions` (thin dispatch wrappers), `useChatContext`. |
| `components/Chatbot/hooks/useChatEffects.ts` | Mount effects: Hello-details saga, thread list fetch, history reload on thread/sub-thread change, `window` `message` listener for `askAi` / `refresh`. |
| `components/Chatbot/hooks/useRtlayerEventManager.tsx` | Opens the rtlayer client and turns AI responses into `Chat` actions. |
| `components/Chatbot/hooks/useReduxEffects.ts` | Mirrors `appInfo[tabSessionId]` ids (thread, sub-thread, bridge, helloId, version) and `isHelloUser` into the `Chat` slice. |
| `components/Chatbot/hooks/useReduxManagement.ts` | `useReduxStateManagement`: one selector that returns Hello/appInfo fields (channel, team, chat ids). Used mostly by Hello code. |
| `components/Chatbot/hooks/chatReducer.ts`, `components/Chatbot/hooks/chatTypes.ts` | The old local React (useReducer) reducer. Dead code; only `SendMessagePayloadType` from `chatTypes.ts` is still imported. |
| `hooks/socketManager.js` | Singleton socket.io client (Hello): connect with JWT, subscribe/unsubscribe channels, re-subscribe on reconnect, region switch. |
| `hooks/socket.js` | `useSocket`: connects `socketManager` with the Hello socket JWT and subscribes the client's channels. |
| `hooks/socketEventHandler.ts` | `useSocketEvents`: handles `NewPublish` and `Typing` socket events for Hello. |
| `hooks/socketEventEmitter.ts` | `useTypingStatus`: emits `typing` / `not-typing` to Hello. |
| `hooks/GTWY/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | Host-page `postMessage` handler for GTWY (sets `threadId`, `bridgeName`, `versionId` …). Owned by [embed-scripts](./embed-scripts.md). |

## Terms

| Term | Meaning here | Where it lives |
|---|---|---|
| bridge | A GTWY AI agent, addressed by its slug. Sent as `slugName`. Defaults to `"root"` when the host gives none (`components/Chatbot/hooks/useReduxEffects.ts:useReduxEffects`). | `appInfo[tabSessionId].bridgeName` |
| `versionId` | Bridge version. The string `"null"` means "no version"; `useSendMessage` converts it to `null` as `version_id`. | `appInfo[tabSessionId].versionId` |
| interface | The GTWY chatbot configuration record (the thing a `chatbot_id` points to). The word is also used for JSON-driven UI components in messages — see [interface-renderer](./interface-renderer.md). | `Interface[chatSessionId]` slice |
| `chatbotId` / `chatSessionId` | The GTWY chatbot id from `interfaceDetails.chatbot_id` in the iframe URL. `app/chatbot/page.tsx` stores it as both `chatbotId` and `chatSessionId` in `draftData`, so `chatSessionId === chatbot_id`. Sent as `chatBotId`. | `draftData` |
| `tabSessionId` | `${chatSessionId}_${tab_session_id}`; key of per-tab state in `appInfo` so two tabs or two widgets don't collide. Built in `store/index.js:getInfoParametersFromUrl`. | `ChatContext` |
| `userId` | The host's end-user id from `interfaceDetails.userId`, set into `appInfo` by `app/chatbot/layout.tsx`. Sent with every message; also the fallback in the rtlayer channel name. | `appInfo[tabSessionId].userId` |
| thread | A conversation container chosen by the host (`threadId`, from the embed script). One thread holds one or more sub-threads. | `appInfo[tabSessionId].threadId` |
| sub-thread | One chat inside a thread; what the drawer lists as "chats". The first sub-thread of a thread has `sub_thread_id === thread_id`. All message state is keyed by `subThreadId`. | `appInfo[tabSessionId].subThreadId` |

For Hello users `subThreadId` holds the Hello **channel** id instead, so the same `messageIds` / `msgIdAndDataMap` maps serve both backends.

## How it works

### Boot and ids
1. `app/chatbot/layout.tsx` parses `interfaceDetails` and writes `chatBotId`, `userId`, `config` into `appInfo`. `app/chatbot/page.tsx` stores the token in sessionStorage as `interfaceToken`.
2. The host sends `threadId`, `bridgeName`, `version_id` by `postMessage`; the GTWY embedding handler writes them into `appInfo` and clears `subThreadId` when the thread changes.
3. `useReduxEffects` copies these ids into the `Chat` slice (`setThreadId`, `setSubThreadId`, …). The source of truth is `appInfo`; the hooks in `useChatActions.ts` read ids from `appInfo`, while reducers in `chatReducerV2.ts` use `state.Chat.subThreadId` as the default key.
4. `useChatEffects` then:
   - dispatches `getHelloDetailsStart({ slugName, versionId })` when `bridgeName` changes. The saga calls `getHelloDetailsApi` (`POST {NEXT_PUBLIC_API_BASE_URL}/hello/subscribe`), which also returns `supportedServices` for the model switcher.
   - calls `useFetchAllThreads` when `threadId` and `bridgeName` are set.
   - calls `useGetInitialChatHistory` whenever `threadId`, `bridgeName` or `subThreadId` changes.

### Threads and sub-threads
- **List**: `useFetchAllThreads` → `getAllThreadsApi` (`GET {NEXT_PUBLIC_API_BASE_URL}/thread/{threadId}?slugName={bridge}`) → `setThreads({ bridgeName, threadId, threadList })`. The list is stored at `Interface[chatSessionId].interfaceContext[bridgeName].threadList[threadId]` (`store/interface/interfaceReducer.ts:setThreads`). An empty list gets one synthetic entry `{ thread_id, sub_thread_id: threadId, display_name: threadId }`.
- **Selecting a sub-thread after a list load**: `store/appInfo/appInfoSlice.ts` handles `setThreads` in `extraReducers`: it keeps the current `subThreadId` if it is in the list, else picks one from the list (or `threadId` when the list is empty).
- **New chat**: entirely client side. `ChatbotHeader.tsx` and `ChatbotDrawer.tsx` (`handleCreateNewSubThread`) dispatch `setThreads({ newThreadData: { sub_thread_id: createRandomId(), thread_id, display_name: "New Chat", newChat } })`. The appInfo extra reducer switches `subThreadId` to the new id. No request is made; the backend learns about the sub-thread from the first `sendMessage`, which sends `thread_flag: true` for a new chat. The backend then publishes a thread record with `display_name` over rtlayer, and `useRtlayerEventManager` replaces the placeholder via `setThreads({ newThreadData })`.
- **Switch**: `components/Interface-Chatbot/ChatbotDrawer.tsx:handleChangeSubThread` dispatches `setDataInAppInfoReducer({ subThreadId })`, which re-runs the history effect and moves the rtlayer listener to the new channel.

### Sending a message
`useSendMessage` (used by the text field, starter questions, interface buttons, and `askAi`):
1. Splits `Chat.images` into `files` (`.pdf`) and `images` (the rest). Returns if there is no text and no image.
2. Clears the input, `setLoading(true)`, clears `options`/`images`, starts a 240 000 ms timeout.
3. Optimistically adds two messages with `setHelloEventMessage`: the user message and an assistant placeholder `{ role: "assistant", content: "Talking with AI", wait: true }`.
4. `sendDataToAction(payload)` → `POST {NEXT_PUBLIC_PYTHON_API_BASE_URL}/chatbot/{chatBotId}/sendMessage`:

```ts
{
  message: string,
  images: string[],            // uploaded image URLs (non-pdf)
  files: string[],             // uploaded .pdf URLs
  userId: string | null,
  interfaceContextData: {...Interface[chatSessionId].interfaceContext[bridge].variables, ...customVariables},
  threadId: string,            // customThreadId || appInfo threadId ("" if empty)
  subThreadId: string,
  slugName: string,            // customBridgeSlug || bridgeName
  thread_flag: boolean,        // true for the first message of a new / default sub-thread
  chatBotId: string,           // chatSessionId
  version_id: string | null,
  configuration?: { model },   // only when the user picked a model
  service?: string             //   in the model switcher
}
```
5. The HTTP response body is ignored on success. On failure `sendDataToAction` shows an error toast and the hook dispatches `removeMessages({ numberOfMessages: 2 })` to drop the optimistic pair.

Images are uploaded beforehand by the text field via `uploadImage` (`POST {NEXT_PUBLIC_PYTHON_API_BASE_URL}/image/processing/`).

### Receiving the answer (rtlayer)
`useRtlayerEventManager` creates `WebSocketClient(...)` from `rtlayer-client` only when the user is not a Hello user, and listens on one channel:

```ts
channel = (chatSessionId + (threadId || userId) + (subThreadId || userId)).replace(/ /g, "_")
```

The backend must publish to exactly this string. The listener is re-attached when `chatSessionId`, `userId`, `threadId` or `subThreadId` changes. Each message is a JSON string; `handleMessageRTLayer` branches on it in this order:

| Condition (first match wins) | Action |
|---|---|
| `status === "connected"` | ignored |
| `response.function_call` and no `response.message` | `updateLastAssistantMessage({ wait: true, content: "Function Calling", Name })` |
| `response.function_call` with `response.message` | `updateLastAssistantMessage({ wait: true, content: message, Name })` |
| no `response.data` and top-level `error` | replace placeholder with the error text, stop loading, clear timeout |
| `data.role === "reset"` and no `data.mode` | add a `"Resetting the chat"` message |
| `data.suggestions` defined | `setOptions(suggestions)` (quick-reply chips) |
| `data.display_name` | `setThreads({ newThreadData: data, threadId: data.thread_id })` (names the new sub-thread) |
| any other `data` | `updateLastAssistantMessage({ role, ...data })`, stop loading, clear timeout |

There is no token streaming. "Streaming" is the `wait: true` assistant message being replaced in place: placeholder → "Function Calling" (tool names in `Name`) → final answer. `Chat.loading` is the "AI is busy" flag; `askAi` while loading shows "Please wait for the response from AI".

### History and pagination
- `getPreviousMessage(threadId, bridgeName, pageNo, subThreadId, limit = PAGE_SIZE.gtwy)` → `GET {NEXT_PUBLIC_API_BASE_URL}/api/v1/config/gethistory-chatbot/{threadId}/{bridgeName}?sub_thread_id=…&pageNo=…&limit=…`. It reverses `data` so the newest message is first, and also returns `starterQuestion`.
- `useGetInitialChatHistory` loads page 1 → `setInitialMessages` (replaces the sub-thread's list), `setStarterQuestions`, `hasMoreMessages = length >= PAGE_SIZE.gtwy` (40, in `utils/enums.ts`).
- `useGetMoreChats` (called by `MessageList.tsx` on scroll) loads `currentPage + 1` → `setPaginateMessages` appends older ids to the end. It stops when `isFetching` or `!hasMoreMessages`.
- The host can force a reload by posting `{ type: "refresh" }`.

### Feedback
`useMessageFeedback` → `sendFeedbackAction` (`PUT {NEXT_PUBLIC_API_BASE_URL}/api/v1/config/status/{feedbackStatus}` with `{ message_id }`) → on `success`, `updateSingleMessage({ messageId, data: { user_feedback } })`.

### socket.io (Hello only)
`useSocket` and `useSocketEvents` are mounted from `components/Chatbot/hooks/useHelloEffects.ts`, and `useTypingStatus` from `ChatbotTextField.tsx`. They never carry GTWY AI replies.
- Connect: `io(getSocketUrl(), { auth: { token: Hello socketJwt.jwt }, transports: ['websocket','polling'] })`. `getSocketUrl` comes from `config/regionConfig.ts` and is read at connect time, so a region change rebuilds the socket.
- Channels subscribed (emit `subscribe` with `{ channel: [...] }`): `ch-comp-{company_id}-{clientId}` (client id from localStorage `k_clientId` or `a_clientId`), every `channelListData.channels[].channel`, and `widgetInfo.event_channels`.
- Events received: `NewPublish` (message types `chat`, `assign`, `feedback`, `block`, `new-channel`, `update`) and `Typing` (`action: typing | not-typing` → `setTyping({ subThreadId: channel, data })`). Emitted: `typing` / `not-typing` on the event channel that contains `"typing"`.
Details of the Hello message handling are in [hello](../integrations/hello.md).

## Contracts

`Chat` slice state (`store/chat/chatReducerV2.ts:initialChatState`, trimmed):

```ts
{
  messageIds: { [subThreadId]: string[] },                  // NEWEST FIRST
  msgIdAndDataMap: { [subThreadId]: { [id]: Message } },
  rawHelloMsgList: { [subThreadId]: any[] },                // Hello only, raw socket/local payloads
  helloMsgIds, helloMsgIdAndDataMap, helloMessages, messages, // legacy, still read in a few places
  starterQuestions: string[], options: any[] /* suggestions */, images: string[],
  isTyping: { [subThreadId]: boolean },                     // Hello agent typing
  loading: boolean,       // waiting for AI / send in flight
  chatsLoading: boolean,  // first history page loading
  isFetching: boolean,    // next history page loading
  currentPage: number, hasMoreMessages: boolean, newMessage: boolean, skip: number,
  threadId, subThreadId, bridgeName, helloId, bridgeVersionId: string, // mirrors of appInfo
  headerButtons: any[], openHelloForm: boolean, isToggledrawer: boolean,
  notifications: { id, content, timestamp, read }[],        // push notifications; persisted
  isHelloUser?: boolean, open?: boolean
}
```

A GTWY message after `convertChatHistoryToGenericFormat` / `convertEventMessageToGenericFormat` (`utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx`):

```ts
{ ...backendFields, id /* from Id, else generated */, content /* chatbot_message || content */,
  role, createdAt, created_at, function, tools_call_data, error, urls,
  wait?, timeOut?, Name? /* function names */, user_feedback? }
```

Invariants other code relies on:
- Index 0 of `messageIds[subThreadId]` is the newest message. `updateLastAssistantMessage` replaces index 0; `removeMessages` trims from the front; `setPaginateMessages` appends older pages at the end.
- Reducers default to `state.Chat.subThreadId` when the payload has no `subThreadId`. The Hello socket handler always passes the channel explicitly.
- `resetState` keeps `threadId`, `bridgeName`, `helloId`, `bridgeVersionId`, `headerButtons`, `notifications`.
- Every HTTP call in `config/api.ts` goes through `utils/interceptor.ts`, which sets `Authorization: sessionStorage.interfaceToken` (or `proxy_auth_token: sessionStorage.ragToken` when the URL contains `rag`). A 401 clears localStorage and redirects to `/?error=session expired`; a 5xx shows "Server Error, Try again later".

Env vars: `NEXT_PUBLIC_API_BASE_URL` (Node GTWY API) and `NEXT_PUBLIC_PYTHON_API_BASE_URL` (Python GTWY API: send message, image upload). See [environment](../environment.md). Endpoint list: [api](../api.md).

## Gotchas

> [!WARNING]
> AI replies come over **rtlayer**, not `socketManager`. The socket manager carries only Hello traffic. Do not move GTWY listening onto socket.io without the backend publishing there.

> [!WARNING]
> The rtlayer channel name is a plain string concatenation `chatSessionId + (threadId || userId) + (subThreadId || userId)` with spaces turned into `_`. The GTWY backend (another repo) builds the same string. Changing either side silently stops replies; the UI then shows "Talking with AI" until the 4-minute timeout.

> [!WARNING]
> The rtlayer credentials are hard-coded in `components/Chatbot/hooks/useRtlayerEventManager.tsx:useWebSocketClient`, not read from env. Do not copy them into docs or other files.

> [!WARNING]
> `updateLastAssistantMessage` keys the message by `payload.id`. The final rtlayer branch and the timeout in `useSendMessage` dispatch payloads that may have no lowercase `id` (only the backend's `data` fields, or `{ timeOut: true }`). Then index 0 becomes `undefined` and the map gets an `"undefined"` key.

> [!WARNING]
> `getPreviousMessage` shares one module-level `AbortController`. Any new history call aborts the one in flight (for example a page-2 load started during a sub-thread switch). On error it returns `[]`, so callers must check `Array.isArray(previousChats)`.

> [!WARNING]
> `useChatEffects` means to skip the history fetch for a brand-new chat, but checks `threadList?.[0]?.subThread_id` (typo for `sub_thread_id`), so the skip never fires and a new chat always requests (empty) history.

> [!WARNING]
> `isHelloUser` comes from two places: `useRtlayerEventManager` reads it from `ChatbotContext`, everything else from `state.draftData.isHelloUser`. If they disagree, rtlayer may stay open for a Hello user or be closed for a GTWY user.

> [!WARNING]
> `ChatbotDrawer.tsx` sets `newChat: "true"` (string) and `ChatbotHeader.tsx` sets `newChat: true`. Both are truthy, so checks work, but compare with truthiness, never `=== true`.

> [!WARNING]
> The `Chat` slice is excluded from the root persist and from cross-tab sync (`store/index.js`: `blacklist` and `crossTabSyncConfig.predicate`). Only `notifications` persists, in widget-scoped localStorage (`store/combineReducer.js:chatPersistConfig`). Messages are reloaded from the API on every open.

Unused exports in `config/api.ts` (no caller in the repo): `performChatAction` (`POST /chatbot/{id}/resetchat`), `createNewThreadApi`, `loginUser`, `getHelloChatsApi`, the interface CRUD helpers (`getAllInterfaceApi`, `createInterfaceApi`, `updateInterfaceApi`, `updateInterfaceActionsApi`, `updateInterfaceDetailsApi`, `deleteInterfaceApi`, `getInterfaceByIdApi`, `deleteComponentOrGridApi`), `createScripts`, `sendMessage`, `allChats`, `getAccessToken`, `getTemplateFlowList`. Check with grep before relying on or deleting them.

## Why it is built this way

- **Two reducers, one live.** The chat state was a local React reducer (useReducer over `chatReducer`) in `Chatbot.tsx`. Commit `2da4094` ("storing data in redux instead of useReducer fo chat reducer data") moved it into the Redux `Chat` slice (`chatReducerV2`, same case names written as Immer reducers) so the many hooks and components could read it with selectors instead of prop/context drilling. `components/Chatbot/hooks/chatReducer.ts` was left behind and nothing imports it; it even references a `ChatActionTypes.SET_OPEN` that the enum does not define. Change `store/chat/chatReducerV2.ts`, not the old file.
- **Messages keyed by sub-thread.** `messageIds` + `msgIdAndDataMap` per `subThreadId` lets the drawer switch chats without refetching what is already in memory and lets Hello channel events land in a channel that is not on screen. `moveThreadMessages` (commit `9253b0c`) moves a temporary sub-thread's messages to the real Hello channel id once it is created.
- **`useReduxEffects` split out** of `useReduxManagement` in commit `9773ee6` to cut redundant dispatches; the mirror copies in `Chat` exist because reducers default to `state.Chat.subThreadId`.
- **socketManager is a singleton** so several Hello hooks share one connection; it re-subscribes stored channels on reconnect (commit `8db4d94`) and rebuilds on region change (commit `c6ea9c1`).

> [!TODO] Needs a human: why GTWY replies use rtlayer while Hello uses socket.io, and whether the rtlayer keys are meant to be public.

## Changing it safely

- New `Chat` field or action: add it to `store/chat/chatReducerV2.ts` (`ChatState`, `initialChatState`, reducer) and export it from `store/chat/chatSlice.ts`. Decide whether `resetState` should keep it. If it must survive reload, add it to `chatPersistConfig.whitelist` in `store/combineReducer.js`.
- New field in the send payload: add it in `useSendMessage` and check the Python backend accepts it. For data from the host page, prefer `interfaceContextData` (variables) over a new top-level key.
- New rtlayer response type: add a `case` in `handleMessageRTLayer` **above** the catch-all `!!data` branch, or it will be treated as the final answer.
- Changing ids or channel naming: update the GTWY backend in the same release (see the channel warning above).
- Check: open `/chatbot` with a GTWY `interfaceDetails`, send a message, and confirm in devtools one `sendMessage` POST, the placeholder, then the answer; create a new chat and confirm it is renamed once `display_name` arrives; scroll up past 40 messages to see page 2 load.

Related: [chat-ui](./chat-ui.md), [interface-renderer](./interface-renderer.md), [AI message flow](../flows/ai-message.md), [hello](../integrations/hello.md), [api](../api.md), [environment](../environment.md).
