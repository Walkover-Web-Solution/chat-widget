---
covers: ["components/**"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Components

All React components live in `components/`, imported with the `@/` alias (`@/components/...`, set in `tsconfig.json`). There is no generic UI-kit folder: components are grouped by feature, and "shared" means "used by more than one message card or view". Behaviour of the chat tree is in [chat-ui](../modules/chat-ui.md); the JSON-driven `Interface-*` widgets are in [interface-renderer](../modules/interface-renderer.md); Hello renderers are in [hello](../integrations/hello.md). This page is the lookup table.

| Folder | What is in it |
|---|---|
| `components/Chatbot-Wrapper/`, `components/Chatbot/` | Root of the widget tree and the hooks that drive it (`components/Chatbot/hooks/`). |
| `components/Interface-Chatbot/` | The chat UI: drawer, header, text field, messages, markdown, reply, emoji, notifications. |
| `components/Hello/` | Hello-only message renderers and the call UI. |
| `components/Interface-*/`, `components/InterfaceDatepicker/`, `components/InterfaceRadio/`, `components/Grid/`, `components/ComponentRenderer.tsx` | Widgets rendered from a GTWY `{ components: [...] }` reply. |
| `components/AppWrapper.tsx`, `components/context.tsx`, `components/customToast.js`, `components/FormComponent.tsx` | App providers, `ChatbotContext`, toasts, Hello pre-chat form. |

## Reusable components

| Component | File | Use it for | Key props / variants |
|---|---|---|---|
| `ImageWithFallback` | `components/Interface-Chatbot/Messages/ImageWithFallback.tsx` | Any attachment: image, video, PDF/file icon, broken-link fallback, download button, full-screen preview | `src`, `alt`, `canDownload` (default true), `preview`, `thumbnail`, `style` |
| `ReadMoreText` | `components/Interface-Chatbot/Messages/ReadMoreText.tsx` | Server-truncated (`show_more`) text; fetches the full body on click | `preview`, `messageId`, `renderContent(text)`, `linkClassName` |
| `InterfaceMarkdown` | `components/Interface-Chatbot/Interface-Markdown/InterfaceMarkdown.tsx` | Rendering markdown (react-markdown + remark-gfm) with the repo's `Code`/`Anchor` renderers | `children`, `className` |
| `Code`, `Anchor` | `components/Interface-Chatbot/Interface-Markdown/MarkdownUtitily.tsx` | react-markdown `components` overrides (copy button, new-tab links) | react-markdown props |
| `CodeBlock` | `components/Interface-Chatbot/Interface-Markdown/CodeBlock.tsx` | Prism syntax highlighting (light build, languages registered at the top of the file) | `inline`, `className` (`language-x`), `isDark` (default true) |
| `MessageTime` | `components/Interface-Chatbot/Messages/MessageTime.tsx` | Time label with daisyUI tooltip | `message`, `tooltipPosition` |
| `DateGroup` | `components/Interface-Chatbot/Messages/DateGroup.tsx` | Date separator between messages from different days | `prevTime`, `messageTime`, `backgroundColor`, `foregroundColor` |
| `RepliedMessage` | `components/Interface-Chatbot/Messages/RepliedMessage.tsx` | Quoted parent shown inside a reply bubble | `message` (+ `chatSessionId` from `addUrlDataHoc`) |
| `ReplyPreview` | `components/Interface-Chatbot/ReplyPreview.tsx` | Bar above the input while replying | `replyToMessage`, `onCloseReply` |
| `EmojiSelector` | `components/Interface-Chatbot/EmojiSelector.tsx` | `frimousse` emoji picker popover; closes on outside click | `isVisible`, `onEmojiSelect({ emoji })`, `onClose` |
| `QuickActionsMenu` | `components/Interface-Chatbot/QuickActionsMenu.tsx` | Kebab menu with minimize / full screen / new conversation | controlled or uncontrolled `open`/`onOpenChange`; `show*` flags; `on*` callbacks; `position`; `useIconColor`; `triggerHoverBg` |
| `MoveToDownButton` | `components/Interface-Chatbot/MoveToDownButton.tsx` | Scroll-to-latest floating button | `movetoDown`, `showScrollButton`, `backgroundColor`, `foregroundColor` |
| `Message` | `components/Interface-Chatbot/Messages/Message.tsx` | Picks the card by `message.role` (`user`, `assistant`, `Human`, `Bot`, `tools_call`, `voice_call`) | `message`, `prevTime`, `isLastMessage` |
| `AssistantMessageCard`, `UserMessageCard`, `HumanOrBotMessageCard`, `ToolsCallMessage`, `VoiceCallMessage` | `components/Interface-Chatbot/Messages/` | One card per role; render through `Message`, not directly | `message` (+ colors / `isBot`) |
| `StarterQuestions` | `components/Interface-Chatbot/Messages/StarterQuestions.tsx` | Starter-question chips on the empty chat | none (reads `Chat.starterQuestions`) |
| `NotificationPage` | `components/Interface-Chatbot/NotificationPage.tsx` | Push-notification list, each in a script-less sandboxed iframe | none (reads `Chat.notifications`) |
| `CallButton`, `CallUI` | `components/Interface-Chatbot/CallButton.tsx`, `components/Hello/callUI.tsx` | Hello voice call start button and in-call panel | `chatSessionId`, `currentChannelId` (via HOC) / none |
| `RenderHello*Message`, `AppleInteractiveMessage` | `components/Hello/` | Hello attachment, feedback, interactive (buttons/list/carousel), video-link and Apple interactive messages | `message` |
| `FormComponent` | `components/FormComponent.tsx` | Hello "your details" form before chatting | `chatSessionId` (via HOC) |
| `Grid` (`InterfaceGrid`) | `components/Grid/Grid.tsx` | Render a `{ components: [...] }` JSON reply | `componentJson`, `msgId` |
| `ComponentRenderer` | `components/ComponentRenderer.tsx` | Map one JSON component `type` to an `Interface*` widget (`componentMap`) | `componentId`, `gridId`, `inpreview` |
| `successToast`, `errorToast`, `warningToast`, `infoToast`, `showSnackbar` | `components/customToast.js` | Imperative toasts from anywhere (API clients, sagas, hooks) | `message` (string) |

The view-level components (`ChatbotWrapper`, `Chatbot`, `ChatbotDrawer`, `ChatbotHeader`, `ChatbotHeaderTab`, `ChatbotTextField`, `MessageList`) each appear once; see [chat-ui](../modules/chat-ui.md#component-tree).

### Dead code (not imported anywhere at b9ab6d6)

| File | Note |
|---|---|
| `components/ThreadSidebar.tsx` | Placeholder. |
| `components/Interface-Chatbot/Messages/DefaultQuestions.tsx` | Imports `./InterfaceChatbot.css`, which does not exist in `Messages/`. Replaced by `StarterQuestions`. <!-- verify:ignore --> |
| `components/ChatbotPreview.tsx`, `components/Chatbot-Preview/ChatbotPreview.tsx` | Identical; the second imports a non-existent `MessageList.jsx`. `/chatbotpreview` uses its own inline markup. They are the only users of `ChatbotHeaderPreview` in `ChatbotHeader.tsx`. <!-- verify:ignore --> |
| `components/Grid/ReactGridItemWrapper.tsx` | Resize wrapper from the old interface builder. |
| `components/InterfaceErrorPage/InterfaceErrorPage.tsx` | "Session expired" text; the 401 handler redirects to `/` instead. |
| `components/inputCombo/inputCombo.js` | Imports `./inputCombo.css`, but only `inputCombo.scss` exists and `sass` is not a dependency. Would break the build if imported. <!-- verify:ignore --> |

Also dead inside live files: `components/Interface-Chatbot/ChatbotDrawer.tsx:handleCreateNewSubThread`, and `components/Chatbot/hooks/chatReducer.ts` (old local reducer). Delete rather than revive.

> [!TODO] Needs a human: OK to delete the dead files above? None is referenced by code or by the `public/` scripts.

## UI libraries

| Library | Used for | Where |
|---|---|---|
| `@mui/material` (+ Emotion) | Layout primitives (`Box`, `Typography`), `Snackbar`/`Alert`, `useMediaQuery`, `LinearProgress`, form inputs in `Interface-*` widgets, `ThemeProvider` | about 34 files |
| `@mui/x-data-grid` | `InterfaceTable` only | `components/Interface-Table/InterfaceTable.tsx` |
| `@mui/icons-material` | A few legacy icons (toast close, accordion, scroll-down, markdown copy) | 6 files |
| `lucide-react` | Default icon set for new UI | about 19 files in `components/` plus `app/rag`, `app/chatbotpreview` |
| Tailwind CSS 3 + daisyUI 4 | Most layout and styling via `className`; daisyUI classes (`loading`, `input`, `select`, `tooltip`, `btn`) | everywhere; see [design-system](design-system.md) |
| `frimousse` | Emoji picker | `EmojiSelector` |
| `react-markdown` + `remark-gfm` | Assistant and Hello markdown | `InterfaceMarkdown`, `AssistantMessage`, `MarkdownUtitily` |
| `react-syntax-highlighter` (Prism light) | Code blocks | `CodeBlock` |
| `react-infinite-scroll-component` | Inverse infinite scroll of messages | `MessageList` |
| `linkify-html` | URL linkifying of plain text (`utils/utilities.js:linkify`) | Hello/voice messages, reply previews |
| `copy-to-clipboard`, `dayjs` | Copy buttons; time formatting | messages, `DateGroup`, `utils/utilities.js:formatTime` |

## Rules

- **Session ids come from the HOC.** Export components that need `chatSessionId`/`tabSessionId` or a per-tab field as `React.memo(addUrlDataHoc(Component, [ParamsEnums.x]))`; do not pass ids down as props from the parent. Only fields listed in `components/Chatbot/hooks/useTabData.ts` can be injected ([app-shell](../modules/app-shell.md#addurldatahoc-what-it-injects)).
- **Colors come from the theme.** Use `components/Chatbot/hooks/useColor.ts:useColor` (or `useTheme().palette`) and the CSS variables in `app/globals.css`; never hard-code the brand color. See [design-system](design-system.md).
- **Icons:** use `lucide-react` for new UI. MUI icons remain only where already used.
- **Toasts:** use `components/customToast.js` helpers. `showSnackbar` mounts each toast in a new React root outside `AppWrapper`, so toasts use the default MUI theme (light, default blue) regardless of the widget theme and dark mode, and cannot read Redux or context.
- **Message cards need `ReplyProvider`.** Any new tree that renders `Message` or its cards must be inside `ReplyProvider` (`components/Interface-Chatbot/contexts/ReplyContext.tsx`); `useReplyContext()` throws otherwise.
- **Untrusted HTML:** do not add new `dangerouslySetInnerHTML` paths for message content. Existing unsafe paths are listed in [chat-ui](../modules/chat-ui.md#gotchas); `NotificationPage` (sandboxed iframe) is the safe pattern.
- **New JSON widget:** add `components/Interface-<Name>/Interface<Name>.tsx` and a lowercase key in `components/ComponentRenderer.tsx:componentMap` ([interface-renderer](../modules/interface-renderer.md)).
- **Screen size:** use `components/Chatbot/hooks/useScreenSize.ts:useScreenSize` (`isSmallScreen` is 1023px or narrower) instead of new media-query hooks.
