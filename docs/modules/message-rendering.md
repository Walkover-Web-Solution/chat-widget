---
covers: ["components/Hello/AppleInteractiveMessage.tsx", "components/Hello/RenderHelloAttachmentMessage.tsx", "components/Hello/RenderHelloFeedbackMessage.tsx", "components/Hello/RenderHelloInteractiveMessage.tsx", "components/Hello/RenderHelloVedioCallMessage.tsx", "utils/dataConvertWrappers/**"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Message rendering

Turns raw MSG91 Hello messages (history API and socket) into one generic message object, stores it in Redux, and renders each `message_type` with a Hello-specific component. The converter runs inside the chat reducers; the renderers are mounted by the message list in `components/Interface-Chatbot/Messages/`.

| File | Role |
|---|---|
| `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` | `convertChatHistoryToGenericFormat` (history items) and `convertEventMessageToGenericFormat` (one socket/local event, returns a 1-element array). Decides `role` (bubble side) and flattens `content`. |
| `components/Hello/RenderHelloInteractiveMessage.tsx` | Interactive messages: WhatsApp-style / generic `button`, `quick_reply`, `cta_url`, `list`, `carousel`, `product`, `product_list`, `location_request`. Hands Apple payloads to `AppleInteractiveMessage`. A click sends the option title as a new visitor message. |
| `components/Hello/AppleInteractiveMessage.tsx` | Apple Messages for Business payloads (quick reply, list picker, time picker, rich link, form, authenticate, Apple Pay, custom iMessage app) drawn as iMessage-style bubbles + full-screen sheets. Also exports detection/preview helpers used by the message card and channel list. |
| `components/Hello/RenderHelloFeedbackMessage.tsx` | CSAT card: 5 emoji ratings + optional comment, posts to Hello, then writes the result back into the store. |
| `components/Hello/RenderHelloAttachmentMessage.tsx` | `attachment` / `text-attachment`: images from `messageJson.attachment[]` plus caption (markdown for bots, linkified HTML for humans), with read-more support. |
| `components/Hello/RenderHelloVedioCallMessage.tsx` | `video_call`: "Click here to join Meet" button; the meet URL is the message text; disabled after `messageJson.expiration_time`. (File name typo "Vedio" is real.) |

Related: message list, bubbles and `ImageWithFallback` / `ReadMoreText` / `InterfaceMarkdown` live in [chat UI components](../ui/components.md); `voice_call` messages are rendered by `VoiceCallMessage` ([voice calling](../modules/voice-calling.md)); endpoints are in [Hello API](../integrations/hello-api.md); the store shape is in [state](../ui/state.md); socket handling is in [realtime](../modules/realtime.md).

## How it works

1. **History.** `components/Chatbot/hooks/useHelloIntegration.ts:useFetchHelloPreviousHistory` calls `getHelloChatHistoryApi` (Hello `/get-history/`) and passes `response.data.data` to `setInitialMessages`; "load more" goes through `setPaginateMessages`. Both reducers in `store/chat/chatReducerV2.ts` call `convertChatHistoryToGenericFormat` and index the result by `id` into `msgIdAndDataMap[subThreadId]` + `messageIds[subThreadId]`.
2. **Live events.** `hooks/socketEventHandler.ts:useSocketEvents` copies `response.timetoken` onto `response.message`, computes `id = response.id || response.message.id || response.timetoken`, and dispatches `setHelloEventMessage({ message: {...message, id}, subThreadId: channel })` for other people's messages and feedback, or `updateHelloMessage` for the visitor's own echo. Both reducers call `convertEventMessageToGenericFormat`. The visitor's own optimistic message (built in `useSendMessageToHello`) and push notifications (`NotificationPage.tsx`, `embeddingScriptEventHandler.ts`, `message_type: 'pushNotification'`) go through the same converter.
3. **Role dispatch.** `components/Interface-Chatbot/Messages/Message.tsx:Message` switches on `role`: `user` → `UserMessageCard` (text + `urls` only), `Human` → `HumanOrBotMessageCard`, `Bot` → `HumanOrBotMessageCard isBot`, `voice_call` → `VoiceCallMessage`.
4. **Type dispatch.** `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` switches on `message_type` using `MESSAGE_TYPES` from `components/Interface-Chatbot/Messages/MessageType.ts` (table below).
5. **Interactive sub-dispatch.** `RenderHelloInteractiveMessage` first asks `detectAppleInteractiveType(messageJson)`; if non-null it renders `AppleInteractiveMessage`. Otherwise it switches on `messageJson.type || messageJson.category || message.message_type`.
6. **Click → message.** Every reply-type option calls the function from `useSendMessageToHello` with the option's title text. That builds a normal visitor text message (`sender_id: "user"`, `content.text = title`) and sends it via `useOnSendHello` → `sendMessageToHelloApi` with `replied_on` = the interactive message's `message_id || id` (or the message the visitor is currently replying to). So an option click is indistinguishable from typing the title, except for the reply metadata. See [send message flow](../flows/send-message.md).
7. **Quoted replies.** `components/Interface-Chatbot/Messages/RepliedMessage.tsx` re-uses `RenderHelloInteractiveMessage`, `RenderHelloAttachmentMessage` and `RenderHelloVedioCallMessage` with a fake `{ messageJson: replied_msg_content }` message inside a `pointer-events-none` box, so quoted buttons are not clickable.

### Dispatch table

| `role` | `message_type` (generic) | Renderer | Dispatched from |
|---|---|---|---|
| `user` | any | `UserMessageCard` (text + `urls`) | `components/Interface-Chatbot/Messages/Message.tsx:Message` |
| `voice_call` | `voice_call` | `VoiceCallMessage` | `components/Interface-Chatbot/Messages/Message.tsx:Message` |
| `Bot` / `Human` | `video_call` | `RenderHelloVedioCallMessage` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |
| `Bot` / `Human` | `interactive` | `RenderHelloInteractiveMessage` → maybe `AppleInteractiveMessage` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |
| `Bot` / `Human` | `attachment`, `text-attachment` | `RenderHelloAttachmentMessage` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |
| `Human` (always) | `feedback` | `RenderHelloFeedbackMessage` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |
| `Bot` | `pushNotification` | `ShadowDomComponent` (HTML in a shadow root) | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |
| `Bot` / `Human` | anything else (plain text) | `InterfaceMarkdown` for bots (not auto-responses), linkified HTML otherwise; `ReadMoreText` when `show_more` | `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` |

### Interactive types (`RenderHelloInteractiveMessage`)

| switch key | Reads | Click sends |
|---|---|---|
| `button`, `quick_reply` | `header`, `body.text`, `footer.text`, `action.buttons` or `actions.buttons` | `button.reply.title || button.title`; `type: 'url'` buttons open `button.url` instead (with optional `assets.image` / `assets.video` preview) |
| `cta_url` | `action.parameters.url` + `display_text`, plus `actions.buttons` | link opens in new tab; extra reply buttons send title |
| `list` | `action.sections` or `actions.list.sections` → `rows[{id,title,description,image}]` | `row.title` |
| `carousel` | `action.cards[]` each with `header`, `body`, `action.name === 'cta_url'` or `action.buttons` | `button.quick_reply.title || button.reply.title || button.title` |
| `product` | `product_details[0].product_items[]`, featured by `action.product_retailer_id` | `product_details[0].text` |
| `product_list` | `product_details[*].product_items` joined to `action.sections[].product_items[].product_retailer_id` | `product.name`, or the CTA `product_details[0].text` |
| `location_request` | `actions.location_request` / `action.location_request` | nothing (display only; the widget cannot share location) |
| other | — | renders "Unsupported Message Type" |

`renderHeader` handles header `type` `text`, `image`, `video`, `document` (the last two are passed to `ImageWithFallback` as if they were images).

### Apple types (`AppleInteractiveMessage`)

`APPLE_INTERACTIVE_TYPES` values and how `detectAppleInteractiveType` finds them (first match wins):

| Type | Detected by | UI | Sent on submit |
|---|---|---|---|
| `apple_rich_link` | `richLinkData` / `rich_link_data` / `richLink`, or `richLinkDataRef` (link taken from `title`), or `type: richlink` + URL `body`; checked first | link card; image via microlink if the payload has none | nothing |
| `apple_quick_reply` | feature data `quick-reply` / `quickReply` / `quick_reply`, or `type: quick_reply` **plus** Apple structure | up to 5 pills | `item.title` |
| `apple_list_picker` | `listPicker` / `list_picker`, or type alias `list_picker` | bubble → sheet; single-select sends on tap, multi-select on Done | title, or titles joined with `", "` |
| `apple_time_picker` | `event.timeslots` / `timePicker` / `time_picker` | bubble → sheet grouped by day | `"<day>, <start> – <end>"` in the business's `timezoneOffset` |
| `apple_authenticate` | `authenticate` / `oauth2` / alias | bubble → info sheet | nothing ("can only be completed inside Apple Messages") |
| `apple_pay` | `payment` / alias | bubble → line-item sheet | nothing |
| `apple_form` | `template === 'messageForms'` or `pages` | bubble → multi-page sheet (`select`, `picker`, `datePicker`, `input`), optional splash and summary | one line per page `"<page title>: <value>"` joined by `\n` |
| `apple_custom` | `receivedMessage` or `appId` with nothing above | app card; opens `https://apps.apple.com/app/id<appId>` when `appId` is numeric | nothing |

Helpers: `getAppleInteractiveData` finds `interactiveData` / `interactive_data` / `interactive.interactiveData`, or treats the whole payload as Apple data when any `APPLE_MARKERS` key is present (Hello flattens it). `getAppleFeatureData` unwraps Apple's `data` object. Images are resolved from `images[]` by `imageIdentifier` (`url`, Hello's `imageurl`, or base64 `data`). After submit, `AppleInteractiveMessageBody` replaces the bubble with a `replyMessage` card, like iMessage does.

Exported helpers used elsewhere:
- `isSelfContainedAppleMessage` — `HumanOrBotMessageCard` drops the padded bubble background for every Apple type except quick reply (avoids a box inside a box).
- `getAppleInteractivePreviewText` — channel-list last-message preview in `components/Interface-Chatbot/ChatbotDrawer.tsx`.

### Feedback (CSAT)

1. Hello sends a socket event `type: 'feedback'` (`hooks/socketEventHandler.ts` also marks the channel closed) or a history item with `message.type === 'feedback'`.
2. The converter's feedback branch keeps `token`, `rating`, `feedback_msg`, `dynamic_values`, `channel`; role is always `Human`.
3. `RenderHelloFeedbackMessage` shows `widgetInfo.feedback_text` (from `state.Hello[chatSessionId]`, `chatSessionId` injected by `hoc/addUrlDataHoc.tsx:addUrlDataHoc`) with `##key##` placeholders replaced from `dynamic_values`, rendered as HTML. Default: "How was your experience?".
4. Submit calls `config/helloApi.ts:submitFeedback` (Hello `/receive-feedback/`, body `{ feedback_msg, rating, token, type: "post-feedback", id, user_data }`). Rating is one of `terrible | bad | ok | good | amazing`; rating is required, comment optional.
5. On success it dispatches `updateHelloMessage({ subThreadId: message.channel, message: {...message, type: 'feedback', rating, feedback_msg} })` so the "Thanks for your feedback!" state survives remounts and channel switches. A card is "submitted" whenever `rating` or `feedback_msg` is set.

## Contracts

Raw Hello message (history item is `{ id?, timetoken, message: HelloRawMessage }`; socket payload is `{ response: { id?, timetoken, message: HelloRawMessage } }`, with `timetoken` and `id` copied onto the message before conversion):

```ts
interface HelloRawMessage {
  type?: 'chat' | 'feedback' | string;      // socket event type; also used on history items for feedback
  message_type?: 'interactive' | 'attachment' | 'text-attachment' | 'video_call' | 'voice_call' | 'pushNotification' | string;
  channel?: string;
  chat_id?: string | number;                // set on messages sent by a widget visitor
  client_sender_id?: string;                // widget-to-widget (peer) channels
  sender_id?: 'user' | 'bot' | 'workflow' | string;  // agent id for human agents
  from_name?: string;
  is_auto_response?: boolean;
  id?: string | number; message_id?: string; timetoken?: number;
  show_more?: boolean;                      // truncated preview (also accepted inside content)
  content?: {
    text?: string;
    attachment?: { path: string; name?: string }[];
    body?: { text?: string; attachment?: any[] };   // older interactive shape
    interactive?: InteractivePayload;               // generic interactive shape
    show_more?: boolean;
    expiration_time?: number;                       // video_call
    status?: string;                                // voice_call
    // legacy interactive fields live directly here: category, header, body, footer, action(s)
  };
  replied_msg_content?: any; replied_msg_sender_id?: string; replied_msg_type?: string; replied_from_name?: string;
  // feedback only
  token?: string; rating?: string; feedback_msg?: string; dynamic_values?: { agent_name?: string; [k: string]: string };
}
```

Generic message produced by the converters (stored in `msgIdAndDataMap`):

```ts
interface GenericMessage {
  role: 'user' | 'Bot' | 'Human' | 'voice_call';
  id: string | number;               // raw id || message.id || timetoken
  message_id?: string;               // not set on feedback / voice_call
  show_more?: boolean;               // not set on feedback / voice_call
  from_name?: string;                // feedback: dynamic_values.agent_name
  content?: string;                  // history: body.text for interactive else text; event: body.text || text
                                     // voice_call: the raw content OBJECT
  urls?: { path: string; name?: string }[];   // content.attachment (event also tries content.body.attachment)
  message_type?: string;
  messageJson?: any;                 // content.interactive || content  (what renderers read)
  time: number | null;               // timetoken
  sender_id?: string;
  is_auto_response?: boolean;        // history feedback branch omits it
  replied_msg_content?: any;         // replied_msg_content.interactive || replied_msg_content
  replied_msg_sender_id?: string; replied_msg_type?: string; replied_from_name?: string;
  // feedback only
  token?: string; feedback_msg?: string; rating?: string; dynamic_values?: object; chat_id?: any; channel?: string;
}
```

Role rules (decide bubble side):
- `convertChatHistoryToGenericFormat`: `voice_call` type → `voice_call`; own (`chat_id` set and `client_sender_id` absent or equal to this client's id from `k_clientId` / `a_clientId` in localStorage) → `user`; `sender_id` `workflow`/`bot` or `is_auto_response` → `Bot`; else `Human`.
- `convertEventMessageToGenericFormat`: own = `sender_id === "user"` or matching `client_sender_id` → `user`; bot as above → `Bot`; any other `sender_id`/`client_sender_id` → `Human`; **no sender info at all → `user`**. It does not look at `chat_id`.
- Feedback → always `Human`.

Renderer props: `RenderHelloInteractiveMessage`, `RenderHelloVedioCallMessage` take `{ message: GenericMessage }`; `RenderHelloAttachmentMessage` takes `{ message, isBot }`; `RenderHelloFeedbackMessage` takes `{ message }` (+ `chatSessionId` from the HOC); `AppleInteractiveMessage` takes `{ messageJson, sendMessageToHello?, readOnly? }`. They must render inside `ReplyContext` and the Hello context providers because `useSendMessageToHello` reads them.

## Gotchas

> [!WARNING]
> Two interactive payload shapes coexist. Generic: `content.interactive = { type: 'button', action: { buttons: [{ type, reply: { title } }] } }`. Legacy WhatsApp-style: fields directly on `content` with `category: 'list'` and `actions.list.sections`. Every case reads both `action` and `actions`; keep doing that when adding a case, or one source silently renders nothing.

> [!WARNING]
> `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` memoizes on `message_type`, `content`, `id`, `message_id`, `show_more`, `isBot` only. A store update that changes only `messageJson`, `rating` or `feedback_msg` does not re-render the renderer. The feedback card copes through its own `justSubmitted` state; a new field you add will not refresh unless you add it to the deps.

> [!WARNING]
> `updateHelloMessage` runs `convertEventMessageToGenericFormat` on whatever you pass. The feedback card passes an already-generic message, which is why it sets `type: 'feedback'` (to hit the feedback branch). The converter reads `timetoken`, not `time`, so the re-converted feedback message ends up with `time: null`.

> [!WARNING]
> A `quick_reply` payload is Apple only when Apple structure (`interactiveData` or an `APPLE_MARKERS` key) is present; otherwise it is the WhatsApp quick reply. The `list` alias for Apple list picker is commented out in `TYPE_ALIASES` on purpose, so plain WhatsApp lists keep the generic `list` renderer. Adding broad aliases steals WhatsApp messages.

> [!WARNING]
> `AppleInteractiveMessage` keeps the "answered" state (`replied`) in component state only. After reload or remount the original bubble shows again and can be answered twice. `readOnly` exists but no caller passes it.

- `RenderHelloInteractiveMessage` has two `case 'carousel'` branches; the second is unreachable.
- Greeting buttons are a synthetic message from `components/Interface-Chatbot/Messages/MessageList.tsx` with `type: 'greeting_msg'`; reply metadata is skipped for it (commit `eb41abe`: a greeting must not reference itself, it has a random id unknown to Hello).
- Rich-link cards call the public microlink API (`api.microlink.io`) from the visitor's browser and cache results in memory and in localStorage under `hello_link_preview:<url>`. Failures fall back silently.
- Feedback header text, non-bot captions and non-bot replied text are injected with `dangerouslySetInnerHTML`. Bot text goes through `InterfaceMarkdown`.
- The video-call URL is `message.content || messageJson.text`; there is no URL validation.

## Why it is built this way

- **One converter, two entry points.** History and socket payloads differ (wrapper `{message}` vs bare message, `timetoken` location), so there are two functions with matching output keys. An `isHello` switch that also handled the GTWY AI chatbot format was removed with GTWY support (`9a37b80`). <!-- verify:ignore -->
- **`content.interactive || content`** was added in `d95b975` ("interactive generic format support") so the same renderer accepts Hello's newer generic interactive payload and the legacy WhatsApp shape.
- **Peer-aware roles** (`client_sender_id`) came with widget-to-widget chat (`17706c8`): in peer channels the other widget's messages also carry `chat_id`, so `chat_id` alone no longer means "mine". `is_auto_response` counts as Bot since `d1ee324`.
- **Clicks reply to the interactive message** (`b3d7e46`, "send msg_id on reply on interactive msg button clicked") so Hello/bots can tie the answer to the question.
- **Feedback persistence** (`d9adbae`, "Submitted feedback reset on refresh"): the converter now carries `rating` / `feedback_msg` and the card initialises from them; the store write-back followed in `eadb5ae`. HTML in the feedback header was added in `61c97b4`.
- **Apple support** (`ab9d7de`, PR #464) is a separate file because Apple payloads arrive in many shapes (nested `interactiveData`, flattened by Hello, snake_case aliases, Hello's WhatsApp-style list builder) and need sheet-style UI. Payment, sign-in and custom apps cannot be completed outside Apple Messages, so they render as informational cards. Replying to an Apple message keys off `message_type === 'interactive'` because Apple payloads have no `category` (`f51ad5e`, in `useOnSendHello`).
- Carousel cards force `text-black` on a white card (`89c2fb7`) because they inherited the bubble's foreground colour.

> [!TODO] Needs a human: what are the full sets of `message_type` and interactive `type` values Hello can send to the web widget, and which channels (WhatsApp, Apple, bot builder) produce each? Code accepts several aliases defensively.

## Changing it safely

- **New `message_type`:** add the constant to `MessageType.ts`, a case in `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent`, and (if it can be quoted) a branch in `RepliedMessage.tsx`. Check whether `role: 'user'` messages need it too: `UserMessageCard` only renders text and `urls`.
- **New interactive type:** add a case in `RenderHelloInteractiveMessage`; read both `action` and `actions`; call `sendMessageToHello(title)` with `e.stopPropagation()` (the card toggles sender/time on click). Update `ChatbotDrawer.tsx` preview text if `body.text` is empty.
- **New Apple feature:** extend `APPLE_INTERACTIVE_TYPES`, `detectAppleInteractiveType` (mind the order: rich link first, quick reply before list), `getAppleInteractivePreviewText`, and the switch in `AppleInteractiveMessageBody`. Make sure a WhatsApp payload of the same name still returns `null`.
- **New field from Hello:** add it to every return branch in both converters (history, event, feedback, voice_call) or it will exist on some messages only; then add it to the `MessageContent` memo deps if the renderer reads it.
- Check by loading a channel with history and receiving the same type live; both paths must render identically.
