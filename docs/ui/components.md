---
covers: ["components/Interface-Chatbot/**", "components/FormComponent.tsx", "components/customToast.js", "utils/readMore.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Chat UI components

The chat UI is everything inside the iframe after boot: the drawer (conversation and team list), the header, the message list, the input box, reply, emoji picker, the notification page, the pre-chat details form and toasts. It lives in `components/Interface-Chatbot/`, plus `components/FormComponent.tsx` and `components/customToast.js`. Colors and dark mode are in [design-system](./design-system.md).

The container that lays these out is `components/Chatbot/Chatbot.tsx:Chatbot` (owned by [hello-api](../integrations/hello-api.md)). It renders only after `helloData` has set `chatSessionId` (see [widget boot](../flows/widget-boot.md)). Messages are sent over HTTP (`POST /v2/send/`); the socket only receives messages, plus the typing event this UI emits (see [send-message](../flows/send-message.md) and [realtime](../modules/realtime.md)).

Out of scope here: `components/Interface-Chatbot/CallButton.tsx` and `components/Interface-Chatbot/Messages/VoiceCallMessage.tsx` ([voice-calling](../modules/voice-calling.md)), and the Hello message renderers in `components/Hello/` ([message-rendering](../modules/message-rendering.md)).

## Layout

```text
ChatbotWrapper  ── ReplyProvider (reply state)
 └─ Chatbot ── MessageContext.Provider (messageRef = the input element)
     ├─ ChatbotDrawer                (left column on desktop, overlay on mobile)
     └─ main column
         ├─ ChatbotHeader ── QuickActionsMenu
         ├─ LinearProgress           (Chat.chatsLoading)
         ├─ FormComponent + CallUI   (hidden while the notification page shows)
         └─ one of:
             NotificationPage        showNotificationView && notifications.length > 0
             EmptyChatView           no subThreadId and no greeting → ChatbotTextField only
             ActiveChatView          MessageList + ChatbotTextField
```

## Component inventory

Most components are wrapped in `hoc/addUrlDataHoc.tsx:addUrlDataHoc`. It injects `chatSessionId` and `tabSessionId` from `state.draftData` (the tab id becomes `${chatSessionId}_${tabSessionId}`), plus any listed `ParamsEnums` keys read from the tab's `appInfo` entry. Parents therefore render them with no props. The Redux shapes are in [state](./state.md).

| Component | File | Use it for | Key props / Redux reads |
|---|---|---|---|
| `ChatbotDrawer` | `components/Interface-Chatbot/ChatbotDrawer.tsx` | Home screen: greeting, notifications row, "Continue Conversations", "Talk to our teams", Call Us / Message buttons, MSG91 branding | Injected ids. Reads `Chat.isToggledrawer`, `Chat.messageIds`, `Chat.msgIdAndDataMap`, `Chat.notifications`, `Hello[id].widgetInfo` (`teams`, `tagline`, `voice_call_widget`, `show_msg91`), `channelListData.channels`, `agent_teams`, `clientInfo.Name`, `helloConfig.show_close_button`/`fullScreen`. Writes `appInfo` via `setDataInAppInfoReducer` |
| `ChatbotHeader` | `components/Interface-Chatbot/ChatbotHeader.tsx` | Title bar: drawer toggle with unread dot, title, quick actions, close; collapsed bar when minimized | `currentTeamId`, `currentChannelId` (injected). Reads `draftData.isChatbotMinimized`, `helloConfig` (`fullScreen`, `parentId`, `isMobileSDK`, `show_close_button`), `appInfo[tab].showNotificationView` |
| `QuickActionsMenu` | `components/Interface-Chatbot/QuickActionsMenu.tsx` | Minimize / full-screen actions. One action renders as an icon with a tooltip; two render as a kebab dropdown | `showMinimize`, `showFullScreen`, `onMinimize`, `onToggleFullScreen`, `position`, optional controlled `open` |
| `ChatbotTextField` | `components/Interface-Chatbot/ChatbotTextField.tsx` | Input box: text, emoji, attachments, reply preview, send, call button | `subThreadId`, `currentTeamId`, `currentChannelId` (injected). Reads `Chat.images`, `Chat.loading`, `draftData.prefillInputMessage`, `widgetInfo.inbox_id`, `helloConfig.show_send_button`/`viewMode`, channel `assigned_type`/`is_blocked` |
| `EmojiSelector` | `components/Interface-Chatbot/EmojiSelector.tsx` | `frimousse` emoji picker popover; closes on outside click or Escape | `isVisible`, `onEmojiSelect`, `onClose` |
| `ReplyPreview` | `components/Interface-Chatbot/ReplyPreview.tsx` | Quoted bar above the input while replying | `replyToMessage`, `onCloseReply` |
| `ReplyProvider` / `useReplyContext` | `components/Interface-Chatbot/contexts/ReplyContext.tsx` | Holds the message being replied to | `replyToMessage`, `setReplyToMessage`, `clearReply` |
| `MessageContext` | `components/Interface-Chatbot/InterfaceChatbot.tsx` | Shares `messageRef` (the input DOM node) | Provided by `Chatbot` |
| `MessageList` | `components/Interface-Chatbot/Messages/MessageList.tsx` | Reverse infinite-scroll list, greeting, "Thinking..." bars, jump-to-bottom | `currentChannelId` (injected). Reads `Chat.messageIds[Chat.subThreadId]`, `Chat.msgIdAndDataMap[...]`, `Chat.loading`, `Chat.hasMoreMessages`, `Chat.newMessage`, `Hello[id].greeting` |
| `Message` | `components/Interface-Chatbot/Messages/Message.tsx` | Dispatches on `message.role`, adds a `DateGroup` | `message`, `prevTime`, `isLastMessage` |
| `UserMessageCard` | `components/Interface-Chatbot/Messages/UserMessage.tsx` | Right-side bubble in the widget color, attachments, reply button | `message`, `backgroundColor`, `foregroundColor` |
| `HumanOrBotMessageCard` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx` | Left-side card for agents (`Human`) and bots (`Bot`); routes `message_type` to a renderer | `message`, `isBot`, `isLastMessage` |
| `RepliedMessage` | `components/Interface-Chatbot/Messages/RepliedMessage.tsx` | Quoted original shown inside a reply bubble | `message.replied_msg_*`, `message.replied_from_name` |
| `ReadMoreText` | `components/Interface-Chatbot/Messages/ReadMoreText.tsx` | "Read more" for server-truncated messages | `preview`, `messageId`, `renderContent`, `linkClassName`. Reads `Chat.subThreadId` |
| `ImageWithFallback` | `components/Interface-Chatbot/Messages/ImageWithFallback.tsx` | Image, video, audio and PDF attachment, with download and error states | `src`, `canDownload`, `preview`, `thumbnail`, `style` |
| `MessageTime` | `components/Interface-Chatbot/Messages/MessageTime.tsx` | Relative time that re-renders every 60 s, with a tooltip for the exact time | `message.time`, `tooltipPosition` |
| `DateGroup` | `components/Interface-Chatbot/Messages/DateGroup.tsx` | Date divider between messages from different days | `prevTime`, `messageTime` |
| `MESSAGE_TYPES` | `components/Interface-Chatbot/Messages/MessageType.ts` | `message_type` constants (`video_call`, `interactive`, `attachment`, `text-attachment`, `feedback`, `pushNotification`) | Also used by `components/Chatbot/hooks/useHelloIntegration.ts` |
| `MoveToDownButton` | `components/Interface-Chatbot/MoveToDownButton.tsx` | Floating jump-to-bottom button | `movetoDown`, `showScrollButton`, colors |
| `InterfaceMarkdown` | `components/Interface-Chatbot/Interface-Markdown/InterfaceMarkdown.tsx` | Markdown (`react-markdown`, `prose` classes) for bot text | `children` (string) |
| `Code`, `Anchor` | `components/Interface-Chatbot/Interface-Markdown/MarkdownUtitily.tsx` | Fenced code with a copy button; links open in a new tab | react-markdown component overrides |
| `CodeBlock` | `components/Interface-Chatbot/Interface-Markdown/CodeBlock.tsx` | Prism highlighter, always the dark `vscDarkPlus` style; only the registered languages highlight | `className` (`language-xxx`) |
| `NotificationPage` | `components/Interface-Chatbot/NotificationPage.tsx` | List of campaign push notifications, each in a sandboxed iframe, with Dismiss and "Chat with us" | Reads `Chat.notifications`. Dispatches `removeNotification`, `setHelloEventMessage`, `setDataInAppInfoReducer` |
| `FormComponent` | `components/FormComponent.tsx` | Pre-chat "Enter your details" banner and modal (name, email, phone) | Reads `Chat.openHelloForm`, `Hello[id].showWidgetForm`, `Hello[id].clientInfo`, session `helloConfig` |
| `successToast`, `errorToast`, `warningToast`, `infoToast` | `components/customToast.js` | Imperative MUI snackbar toasts, usable outside React (for example in `config/helloApi.ts`) | `message` string |
| `hasMoreContent`, `readShowMore`, `extractFullMessageText`, `SHOW_MORE_FIELD` | `utils/readMore.ts` | The single home of the truncation flag name | See [Read more](#read-more) |

## How it works

### Drawer

- On mount `ChatbotDrawer` calls `setToggleDrawer(true)`, so the drawer opens first. `Chatbot` closes it again when `isDefaultNavigateToChatScreen` (no team or one team) is true.
- **Conversation rows** come from `channelListData.channels`, keeping only those with an `id`. Three show by default. The expander reads "See all N conversations", or "Show (N) Closed Conversations" when every hidden one is closed. Closed rows are dimmed and get a "Closed" badge; the reducer moves them to the bottom (4c1fb62).
- **Row title**, first match wins: `assigned_to.name` → the `agent_teams` name for `assigned_type`/`assigned_id` → "AI Assistant" when `assigned_type === 'bot'` → a label for the last message type → "Conversation".
- **Row subtitle**: the newest message in the local store (`msgIdAndDataMap[channel][messageIds[0]]`), otherwise the server's `channel.last_message`. HTML is stripped with `utils/utilities.js:stripHtmlToText`, and a "You: " prefix is added for the user's own messages.
- Peer (widget-to-widget) channels (`is_peer_channel`) show a group icon instead of initials.
- **Selecting a row** dispatches `subThreadId`, `currentChannelId`, `currentChatId` and `currentTeamId`, and closes the notification view. **Selecting a team** clears the channel and chat ids, so the next send creates a new chat. The **Message** button (shown when there are no teams) clears both.
- **Merged widget**: when the session `helloConfig` has both `flow_origin` and `integration` (`config/helloApi.ts:getMergeParams`), the teams section and the call section are hidden (df2f79a "widget merge v1").
- The greeting uses `clientInfo.Name`, or `customer_name` only when `pseudo_name === false`, so generated pseudo names are never shown as real names (f20ea1d).
- The close X shows only on small screens, and never when `show_close_button === false` or `helloConfig.fullScreen` is set (f69b439).

### Header

- Title, first match wins: "Notifications" while the notification view is open → "You" when minimized and the last message is the user's → the assigned agent or team name (`getAgentTeamName`) → the selected team's name → "Conversation".
- Minimize dispatches `draftData.isChatbotMinimized` and emits `MINIMIZE_CHATBOT` to the parent. Expanding again posts `EXIT_FULL_SCREEN_CHATBOT`. Full screen posts `ENTER_FULL_SCREEN_CHATBOT` / `EXIT_FULL_SCREEN_CHATBOT`, and close posts `CLOSE_CHATBOT`. The embed script handles all of these ([embed-script](../modules/embed-script.md)).
- When `helloConfig.fullScreen` is true, the whole right-hand group (quick actions and close) is hidden. The full-screen action is also hidden when `helloConfig.parentId` is set (widget mounted inside a host container), and the full-screen button is hidden for `isMobileSDK`.
- The red dot on the drawer toggle means unread notifications, or a `widget_unread_count` above 0 on any channel.

### Input box

1. Typing writes to both the `inputValue` state and `messageRef.current.value`. It emits a socket `typing` event (`hooks/socketEventEmitter.ts:useTypingStatus`) and `not-typing` after 2 s of quiet.
2. Enter sends; Shift+Enter adds a new line. The send button is disabled while uploading, while the input is empty with no images, and, for bot or workflow channels only, while `Chat.loading` is true (a bot reply is pending). Human-agent channels can send while loading.
3. `handleSendMessage` clears the input and the prefill, calls `useSendMessageToHello` (it reads the text from `messageRef`), emits `not-typing`, and clears the reply.
4. Attachments: the paperclip appears only once a `subThreadId` exists. Up to `MAX_IMAGES` (4) files, uploaded one by one with `config/helloApi.ts:uploadAttachmentToHello` to `inbox_id`; each response's `data[0]` is appended to `Chat.images`.
5. `draftData.prefillInputMessage` (set by `openWithMessage` or `helloConfig.prefillMessage`, d4fd26b) fills the box and is cleared on the first edit or send.
6. A `message` event with `type` `open` from the parent focuses the input.
7. When the peer channel's `is_blocked` is true, the whole box is replaced by "You can no longer send messages in this conversation." (17706c8).
8. `helloConfig.viewMode === 'ticket'` makes the box at least 3 rows tall. `show_send_button: false` hides the button, but Enter still sends.

### Message list

- `messageIds[subThreadId]` is newest-first and is rendered inside a `column-reverse` scroller. `react-infinite-scroll-component` runs with `inverse` and calls `useGetMoreHelloChats` for older pages while `Chat.hasMoreMessages` is true.
- `prevTime` is the time of the next-older message (`index + 1`), and `DateGroup` draws a divider when the date changes. `isLastMessage` marks the newest `Human`/`Bot` message, which shows its sender and time without a click.
- `Hello[id].greeting` (`{ text, options }`) becomes a synthetic interactive button message with `type: 'greeting_msg'`. It is never sent as a reply target.
- "Thinking..." shows when `Chat.loading` is true and the channel's `assigned_type` is `bot`. A missing channel counts as `bot`.
- `Chat.newMessage` (set by a send) scrolls to the bottom and resets itself. The jump button appears once you have scrolled more than 500 px up (`SCROLL_BUFFER`).

`Message` dispatches on `role`: `user` → `UserMessageCard`, `Human` → `HumanOrBotMessageCard`, `Bot` → the same card with `isBot`, `voice_call` → `VoiceCallMessage`. Any other role renders nothing.

`components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` dispatches on `message_type`: `video_call`, `interactive`, `attachment`/`text-attachment` and `feedback` go to the `components/Hello/` renderers; `pushNotification` goes to `ShadowDomComponent`. Default text from a bot that is not an auto-response is rendered as markdown; everything else goes through `linkify` into raw HTML. Self-contained Apple interactive cards (`isSelfContainedAppleMessage`) skip the card padding so boxes do not nest.

### Reply

The commit history calls this "swipe reply", but there is no swipe gesture in the code. A reply button appears when the mouse is over a bubble.

1. **Pick a target.**
   - `UserMessageCard` stores `{ id, content, urls, from_name: from_name || 'User', is_auto_response: false, message_id }`.
   - `HumanOrBotMessageCard` stores the whole normalized message. It shows no reply button on the greeting or on `feedback` messages.
   - Clicking a button on an interactive message also replies: `components/Hello/RenderHelloInteractiveMessage.tsx` passes the current reply target, or else that message's own id, as `replyToMessageId` (not for the greeting).
2. **Preview.** `ReplyPreview` shows the sender ("You" for `from_name === 'User'`, empty for bots without a name) and the text: 60 characters with tags stripped, or the original HTML when it is short. Video calls show a fixed label.
3. **Send.** `ChatbotTextField` passes `replyToMessage.message_id || replyToMessage.id` to `useSendMessageToHello`, which sends it as `replied_on`. For the optimistic local copy, `components/Chatbot/hooks/useHelloIntegration.ts:useOnSendHello` adds `replied_msg_content`, `replied_msg_type`, `replied_msg_sender_id` and `replied_from_name`, so the quote renders before the server echo arrives.
4. **Clear.** The reply is cleared after a send, by the X button, and on every `currentChannelId` change (`components/Chatbot/hooks/useHelloEffects.ts`).
5. **Quoted view.** `RepliedMessage` renders inside both bubble types. It renders nothing unless `replied_msg_type` is `interactive` or the content has text or attachments. Interactive, attachment and video-call quotes reuse the `components/Hello/` renderers. Text from a bot sender is rendered as markdown; text from the user is rendered as raw HTML. The quote has `pointer-events-none`: it cannot be clicked and does not scroll to the original.
6. **Sender label of the quote.** "You" when `replied_msg_sender_id` equals the local `k_clientId`/`a_clientId` (peer channels). Otherwise `replied_from_name`, where `user` becomes "You" and `workflow`/`auto response` become blank. Otherwise a string sender id maps the same way, and a missing sender becomes "You".

Request body of a reply (`config/helloApi.ts:sendMessageToHelloApi`, trimmed):

```json
{
  "type": "widget",
  "widget_msg_id": "<id of the optimistic local message>",
  "message_type": "text",
  "content": { "text": "This is a reply", "attachment": [] },
  "channelDetail": { "...": "only when there is no chat_id yet (new chat) or for the demo widget" },
  "chat_id": 917068,
  "replied_on": "6878a2ea221947b37a92297e",
  "user_data": {},
  "sessionVariables": {}
}
```

`is_anon` is no longer sent (it is commented out). `replied_on` is present only when replying.

### Read more

The backend sends long messages as a preview with `show_more: true`. `utils/readMore.ts:SHOW_MORE_FIELD` is the only place the flag name is written. `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` copies it onto the normalized message with `readShowMore`, and the bubbles check `hasMoreContent(message)`. "Read more" calls `config/helloApi.ts:getFullMessageApi` (`POST /get-history/` with `channel` = `Chat.subThreadId` and `message_id`). Expanding is one-way: "Read less" was removed in 09006f1. On failure the API helper shows a toast, and the button stays so the user can retry.

### Notifications page

`Chat.notifications` is filled by the notification socket ([realtime](../modules/realtime.md)). Each item's HTML renders in an `iframe` with `sandbox="allow-same-origin"`, so its scripts do not run. Its size is measured several times after load (0d19257). "Chat with us" removes the notification, sets `subThreadId` to a fresh `notification-<id>` with empty team and channel, and injects the HTML as a `pushNotification` bot message. The user's first reply then creates a new chat.

### Pre-chat form

- `Chatbot` mounts `FormComponent` when `helloConfig.show_widget_form`, then `widgetInfo.show_widget_form`, then `Hello[id].showWidgetForm` allows it.
- Closed, it is a banner; `Chat.openHelloForm` opens the modal (a bottom sheet on small screens).
- Validation: name is required, at most 26 characters. Email is optional but must look like an email. Phone is optional, exactly 10 digits, with country code `+91` by default.
- Fields that the embed script already supplied (`name`, `mail`/`Email`, `number`/`Phonenumber` in session `helloConfig`) are disabled.
- Submit calls `saveClientDetails` and stores `clientInfo`. Only when all three fields are filled does it set `showWidgetForm: false`; otherwise the banner keeps showing.

### Toasts

`showSnackbar` mounts a fresh React root per toast into `alert-container-<n>` on `document.body`, stacks toasts 80 px apart, and closes each after 3 s. An identical severity+message pair is dropped while one is already on screen. The title is the raw severity word ("error").

## Rules

> [!WARNING]
> The text that gets sent is read from `messageRef.current.value`, not from React state. Any code that changes the input (emoji, prefill, a new feature) must set both `messageRef.current.value` and `inputValue`, as `components/Interface-Chatbot/ChatbotTextField.tsx:handleEmojiSelect` does. Otherwise the user sees one text and a different one is sent.

> [!WARNING]
> The `TeamsList` `useMemo` in `ChatbotDrawer.tsx` leaves out `showAllChannels`, `showAllTeams`, `agentTeams` and `isDarkMode` from its dependencies. It only re-renders because `handleChangeChannel`, `handleChangeTeam` and the other handlers are recreated on every render. Wrapping those handlers in `useCallback` would freeze the "See all" toggles and dark-mode colors. Add the missing dependencies if you touch the memo.

> [!WARNING]
> `HeaderColorWrapper` is a component defined inside `ChatbotHeader`'s render, so React remounts the whole header subtree on every header re-render, for example when a new message changes `lastMessage`. Any local state below it, such as `QuickActionsMenu`'s open flag, resets. Move it out, or make it a plain element, before you add stateful children to the header.

> [!WARNING]
> `ShadowDomComponent` (`pushNotification` messages in the thread) puts the HTML in with `innerHTML` and **re-creates `<script>` tags so they run** in the widget's origin. The notification list, by contrast, sandboxes the same HTML without scripts. Agent and auto-response text is also inserted as raw HTML via `linkify`, as are user text in `RepliedMessage` and the short-text path of `ReplyPreview`. Do not route new untrusted content through these paths.

> [!WARNING]
> In `ChatbotHeader`, `fullScreen` means "not a small screen" (`!isSmallScreen`), while `isFullScreen` is `helloConfig.fullScreen`. They are different things; check which one you need.

> [!WARNING]
> `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` is memoized on `message_type`, `content`, `id`, `message_id` and `show_more` only. If a message's `messageJson` or attachments change while those stay the same, the card does not re-render. Add the field to the dependency list.

> [!WARNING]
> `MessageList` scrolls the element with the global id `scrollableDiv` (`scrollableTarget`). Only one `MessageList` can be mounted at a time.

- **Where colors come from.** Take widget colors from `components/Chatbot/hooks/useColor.ts:useColor` (`primaryBgColor`, `foregroundColor`, `primaryGradientBg`, `primaryTintColor`, `headerHoverBg`), or from `useTheme().palette.primary.main`. daisyUI `primary` classes (`text-primary`, `bg-primary`, `link-primary`) are **not** the widget color; see [design-system](./design-system.md).
- **Icons.** New UI uses `lucide-react`. MUI icons remain only in older pieces (`MoveToDownButton`, `MarkdownUtitily.tsx`, `customToast.js`).
- **Ids.** Read `chatSessionId`, `tabSessionId` and the current channel, team and sub-thread ids through `addUrlDataHoc` injection (pass `ParamsEnums` keys) or `useReduxStateManagement`. Do not take them as props from parents.
- **Navigation.** Navigation is Redux, not routing: change screens by dispatching `setDataInAppInfoReducer` with `subThreadId`, `currentChannelId`, `currentChatId`, `currentTeamId` and `showNotificationView`. Clearing `currentChatId` means the next send creates a new chat.
- **Parent window.** Talk to the host page only through `window.parent.postMessage` with the event names the embed script handles (`CLOSE_CHATBOT`, `ENTER_FULL_SCREEN_CHATBOT`, `EXIT_FULL_SCREEN_CHATBOT`, `downloadAttachment`), or through `utils/emitEventsToParent/emitEventsToParent.tsx:emitEventToParent`.
- **Toasts.** Use `errorToast` and its siblings from `components/customToast.js`. API helpers already toast on failure, so callers should not toast a second time.
- **Truncation flag.** If the backend renames `show_more`, change `utils/readMore.ts` only. Its comment says `truncated` is an alias, but `SHOW_MORE_ALIASES` currently contains only `show_more`.
- **Markdown.** `remark-gfm` is enabled only when `utils/appUtility.js:supportsLookbehind` is true, because GFM's lookbehind regex crashed older browsers (58780b2 "bug fix for remark-gfm plugin"). Keep that guard.
- **Dead code.** The `animate-fade-in` class on `HumanOrBotMessageCard` has no definition (Tailwind defines `animate-fadeIn`), and `Avatar` in `HumanOrBotMessage.tsx` is defined but commented out where it would be used.

## Changing it safely

- **New message type:** add it to `MESSAGE_TYPES`, add a `case` in `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` and, if it can be quoted, in `RepliedMessage`. Add a drawer subtitle or title label in `ChatbotDrawer.tsx` (`titleByType` and the subtitle chain). Normalization goes in `utils/dataConvertWrappers/` ([message-rendering](../modules/message-rendering.md)).
- **New header action:** add an item in `QuickActionsMenu.tsx` (`actions`) and the visibility flag in `ChatbotHeader.tsx`. If the parent must react, add the event to the embed script.
- **New drawer section:** add it inside the `TeamsList` memo and add every value it reads to the dependency list.
- Test both themes, the small-screen layout (overlay drawer, bottom-sheet form), the minimized header, and `helloConfig.fullScreen`.

> [!TODO] Needs a human: in `components/Interface-Chatbot/ChatbotDrawer.tsx:handleVoiceCall`, when a channel is already selected and teams exist, the `else if` branch still switches `currentTeamId` to the first team. Is that intended?
