---
covers: ["components/Chatbot/Chatbot.tsx", "components/Chatbot-Wrapper/**", "components/Interface-Chatbot/**", "components/ThreadSidebar.tsx", "components/customToast.js"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Chat UI

The React tree that draws the widget inside the iframe: drawer (GTWY threads or Hello channels/teams), header, message list, text field, reply, emoji, uploads, notification page. It is mounted by `app/chatbot/[chatbotId]/page.tsx` (both `/chatbot/<id>` for GTWY and `/chatbot/hello` for Hello) and serves both backends from the same components, switching on `state.draftData.isHelloUser`. `components/Interface-Chatbot/CallButton.tsx` belongs to [hello](../integrations/hello.md).

| File | Role |
|---|---|
| `components/Chatbot-Wrapper/ChatbotWrapper.tsx` | Root. Provides `ChatContext` (`chatSessionId`, `tabSessionId`) and `ReplyProvider`; runs the embed-script and localStorage event hooks; posts `interfaceLoaded` to the host. |
| `components/Chatbot/Chatbot.tsx` | Layout. Runs the data hooks, provides `MessageContext`, picks Notification / Empty / Active view. |
| `components/Interface-Chatbot/InterfaceChatbot.tsx` | Only defines `MessageContext` (`messageRef` to the input, `timeoutIdRef`). |
| `components/Interface-Chatbot/ChatbotDrawer.tsx` | Side drawer: GTWY sub-thread list, or Hello notifications row + conversations + teams + "Call Us"/"Message" + branding. |
| `components/Interface-Chatbot/ChatbotHeader.tsx` | Title, drawer toggle, new-thread, bridge/model switchers, host-defined header buttons, quick actions, close; minimized header. |
| `components/Interface-Chatbot/QuickActionsMenu.tsx` | Kebab menu: minimize/expand, full screen, new conversation. |
| `components/Interface-Chatbot/ChatbotHeaderTab.tsx` | "AI Assistant / Human Support" tab strip, shown only when the bridge `mode` includes `"human"`. |
| `components/Interface-Chatbot/ChatbotTextField.tsx` | Input, send, upload, emoji, option chips, reply preview, typing events, blocked-channel notice. |
| `components/Interface-Chatbot/ReplyPreview.tsx`, `components/Interface-Chatbot/contexts/ReplyContext.tsx` | Reply state and the bar above the input. |
| `components/Interface-Chatbot/EmojiSelector.tsx` | `frimousse` emoji picker popover. |
| `components/Interface-Chatbot/NotificationPage.tsx` | Push-notification list (sandboxed iframes) and "Chat with us". |
| `components/Interface-Chatbot/MoveToDownButton.tsx` | Scroll-to-bottom button. |
| `components/Interface-Chatbot/Messages/MessageList.tsx` | Inverse infinite scroll, greeting, "Thinking..." indicator. |
| `components/Interface-Chatbot/Messages/Message.tsx` | Dispatches by `message.role` to a card; adds `DateGroup`. |
| `components/Interface-Chatbot/Messages/*.tsx` (others) | Cards and helpers: `AssistantMessage`, `UserMessage`, `HumanOrBotMessage`, `ToolsCallMessage`, `VoiceCallMessage`, `RepliedMessage`, `ReadMoreText`, `ImageWithFallback`, `DateGroup`, `MessageTime`, `StarterQuestions`. |
| `components/Interface-Chatbot/Messages/MessageType.ts` | `MESSAGE_TYPES` constants for Hello `message_type`. |
| `components/Interface-Chatbot/Interface-Markdown/` | `InterfaceMarkdown`, `Code`/`Anchor` renderers, `CodeBlock` (Prism, always dark). |
| `components/customToast.js` | `successToast`/`errorToast`/`warningToast`/`infoToast`: imperative MUI snackbars, used repo-wide (API clients, sagas). |
| `components/ThreadSidebar.tsx`, `components/Interface-Chatbot/Messages/DefaultQuestions.tsx` | Dead code: not imported by the live tree. |

## How it works

### Component tree

```text
app/chatbot/[chatbotId]/page.tsx
└─ ChatbotWrapper              ChatContext + ReplyProvider, postMessage {type:"interfaceLoaded"}
   └─ ChatbotWithHooks         useEmbeddingScriptEventHandler, useLocalStorageEventHandler; null until chatSessionId
      └─ Chatbot               useChatEffects, useHelloEffects, useReduxEffects, useRtlayerEventManager; MessageContext
         ├─ ChatbotDrawer
         ├─ ChatbotHeader ─ QuickActionsMenu, AiServicesToSwitch, BridgeSwitchDropdown
         ├─ LinearProgress     when state.Chat.chatsLoading
         ├─ FormComponent      Hello + show_widget_form   ┐ hidden while the
         ├─ CallUI             (Hello)                    │ notification page
         ├─ ChatbotHeaderTab                              ┘ is showing
         └─ one of:
            NotificationPage   showNotificationView && notifications.length > 0
            EmptyChatView      ChatbotTextField + StarterQuestions
            ActiveChatView     MessageList ─ Message ─ cards ; ChatbotTextField ─ ReplyPreview, EmojiSelector, CallButton
```

`EmptyChatView` vs `ActiveChatView` (`components/Chatbot/Chatbot.tsx:isChatEmpty`): GTWY is empty when there is no `subThreadId` or `messageIds[subThreadId]` is an empty array. Hello is empty only when there is no `subThreadId` and no greeting (see the `helloMsgIds` warning).

### Where components get their data

- **`addUrlDataHoc`** (`hoc/addUrlDataHoc.tsx`) wraps almost every component here. It injects `chatSessionId` (from `state.draftData.chatSessionId`) and `tabSessionId` = `` `${chatSessionId}_${draftData.tabSessionId}` ``, plus any `ParamsEnums` keys listed in its second argument, read from `state.appInfo[tabSessionId]` by `components/Chatbot/hooks/useTabData.ts`. That is why `<Chatbot />` and `<ChatbotHeader />` are rendered without props.
- **Redux** through `useCustomSelector` (`utils/deepCheckSelector.ts`). Slices read here: `Chat` (messages, loading, drawer, options, images, notifications, starter questions), `Hello[chatSessionId]` (widgetInfo, channelListData, helloConfig, greeting, mode, agent_teams), `Interface[chatSessionId]` (chat title/icon, model switching, thread lists, header buttons, subscribed events), `appInfo[tabSessionId]` (current thread/channel/team, notification view), `draftData` (isHelloUser, prefill, minimized). Shapes live in [state](../ui/state.md).
- **React contexts**: `ChatContext` (session ids, read by `useChatActions`/`useHelloIntegration`), `MessageContext` (input ref, so the drawer and effects can focus the input or read its value), `ReplyContext`, and `ChatbotContext` from `components/context.tsx` (`chatbotConfig`: title, subtitle, width, `allowBridgeSwitch`, `bridges`).
- **Action hooks** (owned by [ai-chat](ai-chat.md) and [hello](../integrations/hello.md)): `useChatActions`, `useSendMessage`, `useGetMoreChats`, `useMessageFeedback` from `components/Chatbot/hooks/useChatActions.ts`; `useSendMessageToHello`, `useOnSendHello`, `useGetMoreHelloChats` from `components/Chatbot/hooks/useHelloIntegration.ts`.
- **Two copies of the current thread.** Components write `appInfo[tabSessionId].subThreadId` (via `setDataInAppInfoReducer`). `components/Chatbot/hooks/useReduxEffects.ts` copies it into `state.Chat.subThreadId`, which `MessageList`, `ReadMoreText` and the feedback buttons read. Write the appInfo one; never set `Chat.subThreadId` directly.

### GTWY mode, Hello mode, mixed

`state.draftData.isHelloUser` is the only switch. `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` sets it `true` when the Hello script sends its init event. `app/chatbot/page.tsx` sets it `false` when a GTWY `token` arrives. Details are in the [widget-boot flow](../flows/widget-boot.md).

| Thing | GTWY (`isHelloUser` false) | Hello (`isHelloUser` true) |
|---|---|---|
| Drawer body | `DrawerList`: sub-threads from `Interface[chatSessionId].interfaceContext[bridgeName].threadList[threadId]` | `TeamsList`: notifications row, "Continue Conversations" (channels), "Talk to our teams", call/message banner |
| Drawer toggle in header | only if more than 1 sub-thread | always |
| New-thread button | when 2+ threads, or the current thread has messages | never |
| Minimize button | no | yes |
| Header title | `chatTitle` / `chatbotTitle` / "AI Assistant" | assigned agent/team name, selected team name, or "Conversation" |
| Send | `useSendMessage` | `useSendMessageToHello` (+ typing events) |
| Upload shown when | `Hello[chatSessionId].mode` includes `vision` or `files` | a channel/thread is selected (`subThreadId`) |
| Upload API | `uploadImage` (`config/api.ts`), returns a URL string | `uploadAttachmentToHello` (`config/helloApi.ts`), returns an object with `path` |
| Pagination | `useGetMoreChats` | `useGetMoreHelloChats` |
| Branding footer | "Powered by GTWY" | "Powered by MSG91" only if `widgetInfo.show_msg91` |

There are three "mixed" cases:
1. **Bot-assigned Hello channel.** Channel `assigned_type` is `bot` (the default when the channel is not found) or `workflow`. `MessageList` shows "Thinking..." while `Chat.loading` is set (bot only), and `ChatbotTextField` disables Send while loading. For a human agent, Send stays enabled while loading.
2. **GTWY bridge with human handoff.** The GTWY bridge details (`getHelloDetailsSaga` in `store/hello/helloGeneratorFunctions.ts`) store `mode` under `state.Hello[chatSessionId].mode`, even in GTWY mode. If it contains `"human"`, `ChatbotHeaderTab` renders.
3. **Merged widget.** When `getMergeParams()` (`config/helloApi.ts`) finds `flow_origin` and `integration` in the `helloConfig` session storage entry, the drawer hides the teams section and the call banner (commit df2f79a "widget merge v1").

> [!WARNING]
> `ChatbotHeaderTab`'s click handler only dispatches `setOptions([])`. It does not change `isHelloUser`, so the AI/Human tabs show state but do not switch mode. Wire a real switch before relying on it.

### Message types and who renders them

Messages are normalized before they reach the UI by `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` (`convertChatHistoryToGenericFormat`, `convertEventMessageToGenericFormat`). `Message.tsx` switches on `role`:

| `role` | Card | Source |
|---|---|---|
| `user` | `UserMessageCard`, plus `AssistantMessageCard isError` if `message.error` | own messages (both modes) |
| `assistant` | `AssistantMessageCard` | GTWY AI reply |
| `Human` | `HumanOrBotMessageCard` | Hello agent or peer |
| `Bot` | `HumanOrBotMessageCard isBot` | Hello `sender_id` `bot`/`workflow` or `is_auto_response` |
| `tools_call` | `ToolsCallMessage` | GTWY function calls (renders only if `message.function` has keys) |
| `voice_call` | `VoiceCallMessage` | Hello call log (needs `content.status`) |
| anything else (`reset`, …) | nothing | |

`AssistantMessageCard` handles `wait` (loading bars), `timeOut`, `image_urls`, and `content`/`chatbot_message`. If the content is a JSON string with `isMarkdown`/`response`, it renders markdown. If it has `components` (and no `isMarkdown`/`response`), it renders `InterfaceGrid` from `components/Grid/Grid.tsx`, which is the JSON UI renderer (see [interface-renderer](interface-renderer.md)). Plain text renders as markdown with `Code`/`Anchor`. It also shows copy and thumbs up/down feedback (`useMessageFeedback`) when `message_id` exists.

`HumanOrBotMessageCard` switches on `message_type` (`MESSAGE_TYPES`): `video_call`, `interactive`, `attachment`/`text-attachment` and `feedback` go to the `components/Hello/RenderHello*` renderers. `pushNotification` goes to an in-file `ShadowDomComponent`. The default case renders `InterfaceMarkdown` for bot messages that are not auto-responses, and linkified raw HTML for everything else. Long messages flagged `show_more` (`utils/readMore.ts:hasMoreContent`) go through `ReadMoreText`, which fetches the full body with `getFullMessageApi(channel, messageId)`.

Message shape the cards read (subset; Hello fields set by the converter):

```ts
{ id, message_id?, role, content?: string, chatbot_message?, urls?: (string | {path})[],
  message_type?, messageJson?, time?, from_name?, sender_id?, is_auto_response?, show_more?,
  replied_msg_content?, replied_msg_type?, replied_msg_sender_id?, replied_from_name?,
  // GTWY only
  wait?, timeOut?, error?, image_urls?, tools_data?, tools_call_data?, function?, user_feedback? }
```

`MessageList` renders the newest message first inside a `column-reverse` container with `react-infinite-scroll-component` `inverse`. `scrollTop` 0 is the bottom. The Hello greeting (`Hello[chatSessionId].greeting`: `text`, `options`) is synthesized as an `interactive` button message with `type: 'greeting_msg'`. Sender name and time show only on the last Human/Bot message, or after a click.

### Reply

1. `ReplyProvider` (in `ChatbotWrapper`) holds `replyToMessage`. A reply button appears on hover in `UserMessageCard` and `HumanOrBotMessageCard` (not on the greeting or on `feedback` messages), and also inside `components/Hello/RenderHelloInteractiveMessage.tsx`.
2. `ChatbotTextField` shows `ReplyPreview` and passes `replyToMessage.message_id || id` as `replyToMessageId` to `useSendMessageToHello`. `useOnSendHello` reads the context too: it builds the optimistic `replied_msg_*` fields and sends `replied_on` through `sendMessageToHelloApi`.
3. `clearReply()` runs after every send.
4. `RepliedMessage` draws the quoted block. It shows "You" when `replied_msg_sender_id` matches the `k_clientId`/`a_clientId` localStorage id (peer channels, commit efa65e2).

> [!WARNING]
> Reply only reaches the backend in Hello mode. In GTWY mode `UserMessageCard` still shows the reply button and preview, but `useSendMessage` ignores the reply and `clearReply()` discards it. `AssistantMessageCard` has no reply button. The preview uses `primaryTintColor`/`primaryTextColor` from `useColor`.

### Uploads

`ChatbotTextField:handleImageUpload` takes `image/*,video/*,audio/*,application/pdf`, at most `MAX_IMAGES` (4) pending, uploads in parallel, and appends the results to `state.Chat.images` via `setImages`. Previews use `ImageWithFallback`. It picks the kind by file extension, and falls back to a `HEAD` request's `content-type` (commit 64981c3). In GTWY a PDF-only message cannot be sent without text (`buttonDisabled`). Switching channel or team clears `images`.

### Header actions

- Host-defined buttons: `state.Interface[chatSessionId].headerButtons` is copied to `Chat.headerButtons`. `renderIconsByType` supports `setting`, `history`, `verticalThreeDots`, `sectionDropdown`. Each emits `HEADER_BUTTON_PRESS` with `emitEventToParent`.
- `BridgeSwitchDropdown` renders when both `Interface.allowBridgeSwitch` and `chatbotConfig.allowBridgeSwitch` are set. It writes `appInfo.bridgeName` and emits `BRIDGE_SWITCH`.
- `AiServicesToSwitch` renders when `Interface.allowModalSwitch` is set. Options are `modalConfig.aiServices` filtered by `availableAiServicesToSwitch`, merged with `DEFAULT_AI_SERVICE_MODALS`. It auto-selects a default.
- Close, full screen and minimize use raw `window.parent.postMessage({type: "CLOSE_CHATBOT" | "ENTER_FULL_SCREEN_CHATBOT" | "EXIT_FULL_SCREEN_CHATBOT"})`. Minimize sets `draftData.isChatbotMinimized` and emits `MINIMIZE_CHATBOT`. The host side is in [embed-scripts](embed-scripts.md) and [api](../api.md).
- Header buttons, quick actions and close are hidden when `helloConfig.fullScreen` is true. The full-screen action is hidden when `helloConfig.parentId` is set (the widget is mounted in a host container) or `isMobileSDK`.

### Drawer (Hello)

- Clicking a channel dispatches `subThreadId = currentChannelId = channel.channel`, `currentChatId = channel.id`, `currentTeamId`. Clicking a team clears the channel, which starts a new chat for that team on first send.
- The title comes from `assigned_to.name`, then `agent_teams` lookup by `assigned_type`/`assigned_id`, then "AI Assistant" for bots, then a label by last message type. Peer channels (`is_peer_channel`) show a group icon. Closed channels get a "Closed" badge.
- 3 items are shown, then "See all".
- "Call Us" picks the first channel (or team) if none is selected. It passes overrides to `useOnSendHello({voiceCall: true, ...})` in the same tick, then calls `helloVoiceService.initiateCall` (commit 72cc3f9).
- The greeting name hides pseudo names (`channelListData.pseudo_name === false` required, commit f20ea1d).

### Notifications

`state.Chat.notifications` is filled by the notification socket ([rag-and-notifications](rag-and-notifications.md)). When there are any, the drawer shows a "Notifications" row that sets `appInfo.showNotificationView`. `NotificationPage` renders each notification's HTML in an `iframe sandbox="allow-same-origin"` (no scripts) and auto-sizes it. "Chat with us" creates `subThreadId: notification-<id>`, clears channel/team, and injects a `pushNotification` bot message with `setHelloEventMessage`.

### Theming

Colors come from the MUI theme that `components/AppWrapper.tsx` builds from `helloConfig.primary_color` (session storage) and from light/dark/system mode. `components/Chatbot/hooks/useColor.ts` derives `primaryBgColor`, `primaryTextColor`, `foregroundColor` (black/white by contrast via `isColorLight`), `primaryGradientBg`, `primaryTintColor`, `headerHoverBg`. Surfaces use CSS variables from `app/globals.css` (`--background`, `--foreground`, `--drawer-color`, `--icon-color`, `--message-card-background`, `--error-color`), switched by `data-theme`. Use `useColor` and these variables instead of hard-coded colors (commits 5a8537d "implement dark theme", 845ebdf). See [components](../ui/components.md).

## Contracts

- `ChatbotWrapper` posts `{type: "interfaceLoaded"}` to the parent once on mount. Host scripts wait for it.
- `ChatbotTextField` focuses the input when the host posts `{type: "open"}`. `draftData.prefillInputMessage` pre-fills the input once and is cleared on the first edit or send (priority: the open-with-message event, then `helloConfig.prefillMessage`; commit 2c151ec).
- `UserMessageCard` emits `MESSAGE_CLICK` only if the host subscribed (`Interface.eventsSubscribedByParent` includes `ALLOWED_EVENTS_TO_SUBSCRIBE.MESSAGE_CLICK`).
- When a Hello channel has `is_blocked`, the text field is replaced by "You can no longer send messages in this conversation." (peer channels, commit 17706c8).
- `useReplyContext()` throws outside `ReplyProvider`. Any new tree that renders message cards (for example the chatbot preview) must wrap them.
- `showSnackbar` dedupes identical severity+message pairs while one is visible, stacks up to 12 at 80px offsets, and auto-closes after 3s. It creates a new React root per toast.

## Gotchas

> [!WARNING]
> `state.Chat.helloMsgIds` is never written. Hello messages live in `Chat.messageIds`/`msgIdAndDataMap` like GTWY ones, so `isChatEmpty` in Hello mode is true only when `subThreadId` is empty and there is no greeting. Selecting a team (which clears `subThreadId`) shows `EmptyChatView`, and selecting any channel shows `ActiveChatView`, even if it is empty.

> [!WARNING]
> Drawer open/close depends on effect order. `ChatbotDrawer` calls `setToggleDrawer(true)` whenever `chatSessionId` is set. `Chatbot` then closes it when `isDefaultNavigateToChatScreen` (≤1 team, ≤1 channel, no channel id), and opens it for a Hello user with no `currentChatId`. Child effects run before parent effects, so moving these effects or adding another `setToggleDrawer` changes what users see first. On screens 1023px or narrower (`useScreenSize`), each drawer selection closes the drawer.

> [!WARNING]
> `renderIconsByType` in `ChatbotHeader.tsx` calls `useState`/`useEffect` inside the `sectionDropdown` case of a plain function called from `.map`. If the host changes `headerButtons` at runtime, React's hook order breaks. Make it a real component before you touch it.

> [!WARNING]
> Some message HTML is not sanitized. Human/auto-response text and `VoiceCallMessage` render through `linkify` + `dangerouslySetInnerHTML`. `ReplyPreview` and `RepliedMessage` inject reply text as HTML. `ShadowDomComponent` (`pushNotification` messages) re-creates `<script>` tags so they execute. Only `NotificationPage` uses a no-script sandboxed iframe. Do not route untrusted content into these paths.

> [!WARNING]
> `images` entries differ by mode: URL strings in GTWY, objects with `path` in Hello. `imagePreviewsSection` and `UserMessageCard` branch on this. Code that reads `Chat.images` must handle both.

- `components/Interface-Chatbot/ChatbotDrawer.tsx:handleCreateNewSubThread` is never rendered. The live "new chat" is in `ChatbotHeader.tsx` (`newChat: true`, not the string `"true"`).
- `ChatbotDrawer.tsx` and `ChatbotHeader.tsx` are the most-churned files here (about 107 and 82 commits). Most fixes were "fallback for undefined field" (af8024c), "close button in full screen" (f69b439), and name/title resolution. Re-test both modes, small and large screens, minimized, and full screen after any edit.
- `components/Chatbot-Preview/ChatbotPreview.tsx` imports "Messages/MessageList.jsx", which does not exist. The preview is owned by [interface-renderer](interface-renderer.md).
- `DefaultQuestions.tsx` imports a CSS file that does not exist next to it. It is dead; delete it rather than revive it.

## Why it is built this way

- One component set for both backends instead of two widgets. Commits 23d8dc5 "Use tab data hook and gtwy handling" and 00039fe "Multi Widget handling | redux arc change" moved per-tab state into `appInfo[tabSessionId]` and per-widget state into `Hello`/`Interface[chatSessionId]`, so several widgets and tabs can coexist. That is why everything goes through `addUrlDataHoc`.
- Chat data moved from a component-local reducer to Redux (2da4094) so the socket handlers, the drawer and the header can share it. `components/Chatbot/hooks/chatReducer.ts` is the leftover initial state.
- Notifications use iframes with no scripts, unlike the shadow-DOM push message, so campaign HTML cannot touch the widget (36fbeea, 0d19257 for auto-sizing).
- Closed chats move to the bottom and reopen on a new message (4c1fb62). On close, `setChannelClosedStatus` in `store/hello/helloReducer.ts` moves the channel to the end of the list; the drawer does not sort.

> [!TODO] Needs a human: is `ChatbotHeaderTab` (AI/Human tabs) meant to switch modes, or is it an abandoned feature that should be removed?

> [!TODO] Needs a human: should reply be supported for GTWY (AI) chats, or should the reply button be hidden when `isHelloUser` is false?

## Changing it safely

- **New message type**: add the constant to `MESSAGE_TYPES`, normalize it in `makeGenericDataFormatUtility.tsx`, render it in `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` (Hello) or `Message.tsx` (new role). Also update the drawer subtitle (`ChatbotDrawer.tsx` `titleByType`/subtitle) and the minimized header preview, which each have their own type-to-text logic.
- **New header action**: add it to `QuickActionsMenu` props and pass flags from `ChatbotHeader`. If the host must react, add the event name to `ParentEventType` in `utils/emitEventsToParent/emitEventsToParent.tsx` and document it in [api](../api.md).
- **Any state-driven UI**: read session ids from `addUrlDataHoc` props and select per-session keys (`Hello?.[chatSessionId]`, `appInfo?.[tabSessionId]`). A global key leaks between widgets.
- **Check**: run the widget locally in both modes (GTWY script and Hello script, see [embed-scripts](embed-scripts.md)). Check drawer, header, send, upload, reply, dark mode, and widths of 1023px and below vs 1024px and above. There is no test suite for these components.
