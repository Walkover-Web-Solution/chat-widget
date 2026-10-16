---
covers: ["components/Interface-Accordion/**", "components/Interface-Box/**", "components/Interface-Button/**", "components/Interface-Card/**", "components/Interface-Checkbox/**", "components/Interface-Divider/**", "components/Interface-DropDown/**", "components/Interface-Form/**", "components/Interface-Icon/**", "components/Interface-Link/**", "components/Interface-Table/**", "components/Interface-Text/**", "components/Interface-TextField/**", "components/InterfaceDatepicker/**", "components/InterfaceErrorPage/**", "components/InterfaceRadio/**", "components/inputCombo/**", "components/ComponentRenderer.tsx", "components/Grid/**", "components/FormComponent.tsx", "components/ChatbotPreview.tsx", "components/Chatbot-Preview/**", "app/chatbotpreview/**", "store/interface/**", "types/interface/**", "utils/dataConvertWrappers/**"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Interface renderer (JSON-driven UI) and the `Interface` slice

Renders a GTWY AI reply whose content is a JSON object with a `components` array as MUI widgets (buttons, cards, tables, text fields …) inside the assistant bubble. The only caller is `components/Interface-Chatbot/Messages/AssistantMessage.tsx`, which mounts `components/Grid/Grid.tsx` (imported there as `InterfaceGrid`). This doc also covers the Redux `Interface` slice (per-chatbot UI config, thread lists, host variables), the message normalizer `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx`, the `/chatbotpreview` demo page, and a few unrelated files that live under these globs.

"Interface" means two things in this repo: the JSON UI described here, and the GTWY chatbot configuration stored in `Interface[chatSessionId]`. See the terms table in [ai-chat](./ai-chat.md).

| File | Role |
|---|---|
| `components/Grid/Grid.tsx` | Entry point. Resolves `variables.*` placeholders in the JSON, puts it in `GridContext`, lazy-loads `Viewonlygrid`. Exports `GridContext`. |
| `components/Grid/Viewonlygrid.tsx` | Maps the components array to one `ComponentRenderer` per index, stacked vertically. |
| `components/ComponentRenderer.tsx` | `componentMap`: lowercase `type` string → React component. Reads `props`, `action`, `meta` for its index from `GridContext`. |
| The `Interface-<Name>/` folders under `components/`, plus `components/InterfaceDatepicker/Interfacedatepicker.tsx`, `components/InterfaceRadio/InterfaceRadio.tsx` | The widgets. Thin wrappers over MUI. |
| `components/Grid/ReactGridItemWrapper.tsx`, `components/Grid/Grid.css` | Leftovers from a `react-grid-layout` editor. Nothing imports the wrapper; the CSS classes are unused by the view-only grid. |
| `components/InterfaceErrorPage/InterfaceErrorPage.tsx` | "Session expired" message. Not imported anywhere. |
| `components/inputCombo/inputCombo.js` | Copy-to-clipboard field. Not imported anywhere; imports ./inputCombo.css, which does not exist (the stylesheet is inputCombo.scss). |
| `store/interface/interfaceSlice.ts`, `store/interface/interfaceReducer.ts` | Redux slice `Interface` (mounted in `store/combineReducer.js` as `Interface`). |
| `store/interface/interfaceSaga.ts` | Empty saga. |
| `types/interface/InterfaceReduxType.ts` | `$InterfaceReduxType` and older editor types (`InterFaceDataType`, `CoordinateType`, `ComponentType`) that nothing reads. |
| `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` | Normalizes GTWY and Hello messages into the one message shape the chat UI reads. Not part of the JSON renderer; lives here by folder. |
| `components/FormComponent.tsx` | Hello "Enter your details" form (name, email, phone) rendered by `components/Chatbot/Chatbot.tsx`. Not part of the JSON renderer; see [chat-ui](./chat-ui.md) and [Hello](../integrations/hello.md). |
| `app/chatbotpreview/page.tsx` | `/chatbotpreview`: a static, self-contained demo chat used to preview the theme color. |
| `components/ChatbotPreview.tsx`, `components/Chatbot-Preview/ChatbotPreview.tsx` | Two near-identical older preview components. Neither is imported anywhere. |

## How it works

### Where the JSON comes from
1. The GTWY bot reply arrives over rtlayer (or from history) and is stored in the `Chat` slice; see [ai-chat](./ai-chat.md).
2. `AssistantMessage.tsx` runs `isJSONString` on `message.chatbot_message || message.content` (or `message.error` for error cards) and `JSON.parse`s it.
3. If the parsed object has `isMarkdown` or `response`, it renders markdown. Otherwise, if it has `components`, it renders:
   ```tsx
   <InterfaceGrid componentJson={parsedContent} msgId={message?.createdAt}
                  gridId={parsedContent?.responseId || "default"} inpreview={false} ingrid={false} loadInterface={false} />
   ```
   So the JSON is produced by the GTWY agent (its response format), not by a separate config API and not by `postMessage`. Hello interactive messages use `components/Hello/RenderHelloInteractiveMessage.tsx`, not this renderer.

> [!TODO] Needs a human: which GTWY backend setting makes an agent emit the `{ components: [...] }` response format, and is there a published schema for it?

### Rendering
1. `Grid` walks the whole JSON with `replaceDynamicPaths`. A string that is exactly `variables.a.b[0]` is replaced by the value at that path (any type); a string that contains such a path gets it substituted as text. The lookup context is the **same JSON** (`replaceDynamicPaths(componentJson, componentJson)`), so values must be in a top-level `variables` key of the reply.
2. `Grid` provides `GridContext` = `{ gridContextValue: { ...resolvedJson, msgId }, componentJson }` (the raw JSON is kept so `ComponentRenderer` can pass `propsPath` from the unresolved props).
3. `Viewonlygrid` reads `gridContextValue.components` (or the value itself if it is an array) and renders a `ComponentRenderer` per item, keyed by `component.id` or index. There is no layout: items stack in array order.
4. `ComponentRenderer` lowercases `type`, looks it up in `componentMap`, and calls it with `{ props, componentId, inpreview, dragRef, action, meta, propsPath }`. Unknown types render `null`. `componentId` is the whole component object, not an id string.

### Component type map (`components/ComponentRenderer.tsx:componentMap`)

| `type` (case-insensitive) | Component | Props it reads |
|---|---|---|
| `input`, `textfield`, `textarea` | `InterfaceTextfield` | any MUI `TextField` props |
| `button` | `InterfaceButton` | label from `label` / `children` / `text` / `title` / `name`; `color` forced to `default`/`inherit`/`primary`/`secondary` |
| `card` | `InterfaceCard` | `title`/`heading`/`children`, `description`/`subtitle`, `image`/`imageURL` |
| `text`, `typography` | `InterfaceText` | MUI `Typography` props; text in `children` |
| `markdown` | `InterfaceMarkdown` (owned by [chat-ui](./chat-ui.md)) | |
| `link` | `InterfaceLink` | MUI `Link` props (`href`, `children`) |
| `select` | `InterfaceDropdown` | `label`, `options: string[]` (required) |
| `radio` | `InterfaceRadio` | `options: string[]` (required) |
| `checkbox` | `InterfaceCheckbox` | `label` |
| `datepicker` | `Interfacedatepicker` | native `<input type="date">` attrs |
| `accordion` | `InterfaceAccordion` | `title`, `description` |
| `divider` | `InterfaceDivider` | `type` → orientation |
| `icon` | `InterfaceIcon` | `<img>` attrs (`src`) |
| `table` | `InterfaceTable` | `data: object[]`; optional `meta` for server pagination |
| `box`, `form` | `InterfaceBox`, `InterfaceForm` | render a nested `Grid` with no `componentJson` (see Gotchas) |
| `chatbot` | `components/Chatbot/Chatbot.tsx` | the whole chatbot |

### Actions (what a click does)
`InterfaceButton` and `InterfaceCard` call `utils/ChatbotUtility.ts:perFormAction(action, sendMessage, props)`, which switches on `action.actionType`:
- `"reply"` → `useSendMessage` sends the button's label as a normal user message to the bot (same HTTP path as typing it; see [ai-chat](./ai-chat.md)).
- `"sendDataToFrontEnd"` → `emitEventToParent('FRONT_END_ACTION', action.variables || action.variable || action.data || action.dataToSend || {})`, a `window.parent.postMessage({ type, data }, "*")` to the host page. The host receives it through the embed script.
  Protocol: [api.md](../api.md) <!-- verify:ignore -->
- anything else → nothing.

There is no backend API call for actions and no form submit. Input widgets (text field, select, radio, checkbox, date, accordion) only write their value into Redux with `addInterfaceContext`; nothing reads it back (see Gotchas).

## Contracts

Reply JSON the renderer accepts (keys the code reads; everything else ignored):

```jsonc
{
  "responseId": "optional, becomes gridId",
  "variables": { "user": { "name": "Ana" } },          // lookup source for "variables.*" strings
  "components": [                                        // or the top-level value may itself be the array
    { "id": "optional key", "type": "Text", "props": { "children": "Hi variables.user.name" } },
    { "type": "Button", "props": { "label": "Yes" }, "action": { "actionType": "reply" } },
    { "type": "Button", "props": { "label": "Open" },
      "action": { "actionType": "sendDataToFrontEnd", "variables": { "orderId": 42 } } },
    { "type": "Table", "props": { "data": [{ "a": 1 }] },
      "meta": { "apiCallId": "…", "outputDataKey": "data", "currentPageInputVariable": { "limit": 5 },
                "currentPageOutputPaginationVariables": { "total": 20 }, "nextPageVariableGenerator": "return {...}" } }
  ]
}
```

The reply must **not** contain `isMarkdown` or `response`, or it is rendered as markdown instead.

`Interface` slice state (`types/interface/InterfaceReduxType.ts:$InterfaceReduxType`), keyed by `chatSessionId` (= GTWY `chatbot_id`). Every reducer reads `chatSessionId` from `action.urlData`, which `store/index.js` attaches to each action; a reducer returns early without it.

```ts
Interface[chatSessionId] = {
  // set by GTWY/Hello embed handlers via setDataInInterfaceRedux (hooks/*/eventHandlers/embeddingScript/…)
  allowModalSwitch?, chatTitle?, chatSubTitle?, chatIcon?, allowBridgeSwitch?, hideFullScreenButton?,
  headerButtons: { type: 'history' | 'setting' }[],         // setHeaderActionButtons
  eventsSubscribedByParent: string[],                        // setEventsSubsribedByParent (filtered by ALLOWED_EVENTS_TO_SUBSCRIBE)
  modalConfig: { aiServices: { service, modals[] }[], defaultSelected },  // setModalConfig
  availableAiServicesToSwitch,                               // setAvailableModelsToSwitch (hello saga, supportedServices)
  selectedAiServiceAndModal: { service, modal },             // setSelectedAIServiceAndModal (ChatbotHeader)
  interfaceContext: {
    [bridgeName]: { variables: {...}, threadList: { [threadId]: Thread[] }, interfaceData: {} },  // addDefaultContext, setThreads
    context?: { [gridId or `${gridId}_${msgId}`]: { [componentId]: value } }                     // addInterfaceContext (never read)
  },
  isLoading, interfaceData, currentSelectedComponent       // from initialState; unused
}
```

`interfaceContext[bridgeName].variables` is sent as `interfaceContextData` with every message by `useSendMessage`. `setThreads` is owned functionally by [ai-chat](./ai-chat.md) (thread list semantics, the synthetic first sub-thread).

### `makeGenericDataFormatUtility`
Exports `convertChatHistoryToGenericFormat(history, isHello)`, `convertEventMessageToGenericFormat(message, isHello)` and two trivial payload builders (`createSendMessageGtwyPayload`, `createSendMessageHelloPayload`). Called by `store/chat/chatReducerV2.ts` (and the dead `components/Chatbot/hooks/chatReducer.ts`).
- GTWY (`isHello=false`): spreads the message, sets `id: Id`, `content: chatbot_message || content`. Event version returns a one-element array and generates an id if `Id` is missing.
- Hello (`isHello=true`): computes `role`: `voice_call` for calls; `user` for own messages (`chat_id` present and `client_sender_id` absent or equal to the `k_clientId`/`a_clientId` in localStorage); `Bot` for `sender_id` `bot`/`workflow` or `is_auto_response`; else `Human`. Feedback messages become `role: "Human"`, `message_type: 'feedback'`. Text comes from `content.body.text` for `interactive`, else `content.text`; the raw payload goes to `messageJson`.

The role rules for history and live events differ slightly: a live event with no sender info at all is treated as `user`. Keep both functions in step when changing role logic. The output shape is documented in [chat-ui](./chat-ui.md#message-types-and-who-renders-them).

### `/chatbotpreview`
`app/chatbotpreview/page.tsx` is a hard-coded demo (three sample messages, fake "demo bot response" after 1 s, fake conversation list). It listens for `window` `message` events with `{ type: "themeChange", themeColor }` and calls `ThemeContext.handleThemeChange` from `components/AppWrapper.tsx`, so a parent page can iframe it and recolor it live. It uses no Redux, no API and none of the interface components.

> [!TODO] Needs a human: which app iframes `/chatbotpreview` and sends `themeChange` (presumably the GTWY dashboard's chatbot config screen)? Nothing in this repo references the route.

## Gotchas

> [!WARNING]
> Interface input values go nowhere. Inputs dispatch `addInterfaceContext`, which writes `interfaceContext.context[gridId…][componentId]`. Nothing reads `interfaceContext.context`; `useSendMessage` sends `interfaceContext[bridgeName].variables`. Also `ComponentRenderer` never passes `gridId` (the prop is commented out) and passes the component object as `componentId`, so the keys are `undefined` / `[object Object]`. If you need form data sent to the bot, you must build that path.

> [!WARNING]
> `InterfaceCard` calls `perFormAction(action)` without `sendMessage`. A card with `actionType: "reply"` throws `sendMessage is not a function` on click. Only `sendDataToFrontEnd` works on cards.

> [!WARNING]
> `InterfaceTable` with `meta` runs `new Function(...)` on `meta.nextPageVariableGenerator` (a string from the AI reply) and POSTs to `https://flow.sokt.io/func/{apiCallId}`. That is code execution driven by bot output inside the widget origin. Do not widen it, and treat the reply JSON as untrusted.

> [!WARNING]
> `box` and `form` render a nested `Grid` with no `componentJson`, so their children never render: the nested `Viewonlygrid` gets `{ msgId: undefined }`, which is not an array. Nested layouts are not supported today; the `children` and `coordinates` keys in `types/interface/InterfaceReduxType.ts` are from a removed editor.

> [!WARNING]
> `select` and `radio` crash when `props.options` is missing (`props?.options[0]` without `?.` on the index). Buttons and cards `delete props.action` and mutate `props.color` on the resolved JSON object in place.

> [!WARNING]
> `componentMap` keys must be lowercase: `type` is lowercased before lookup. The branch `type === "Button" || type === "ChatBot"` in `ComponentRenderer` therefore never matches; it is dead code, not a special case.

> [!WARNING]
> `store/interface/interfaceSlice.ts` destructures many action names that have no reducer (`getAllInterfaceStart`, `updateRenderingJson`, `deleteComponentStart`, …). They are `undefined`; dispatching one throws. The live reducers are the ones in `store/interface/interfaceReducer.ts:reducers`.

> [!WARNING]
> `components/Chatbot-Preview/ChatbotPreview.tsx` imports ../Interface-Chatbot/Messages/MessageList.jsx, which does not exist (the real file is `components/Interface-Chatbot/Messages/MessageList.tsx`). It only builds because nothing imports it. Do not wire either `ChatbotPreview` component in; `/chatbotpreview` is the page in use.

## Why it is built this way

- The renderer is the view-only half of an older drag-and-drop interface builder (commit `53205f2` "rendering components", March 2025). The editor parts (`react-grid-layout` CSS, `ReactGridItemWrapper`, `coordinates`, the `getAllInterface*`/`updateInterface*` action names) were dropped when the widget became read-only, which is why types and the slice still describe more than the code does.
- `perFormAction` switched from "always post `FRONT_END_ACTION` to the parent" to the `actionType` switch with `reply` in commit `53aaa4e` ("new type for action … bug solve for two component having same id", May 2025). The same commit made `Viewonlygrid` key items by `component.id || index`.
- `/chatbotpreview` was rewritten into the self-contained demo in commit `4dc811d` ("update chatbot preview", May 2025), replacing the `ChatbotPreview` components that render the real `MessageList`.

> [!TODO] Needs a human: is `InterfaceTable`'s `flow.sokt.io` pagination still used by any agent, or can it be removed?

## Changing it safely

**Add a component type**
1. Create `components/Interface-<Name>/Interface<Name>.tsx`. Accept `{ props, action, meta, propsPath, componentId, inpreview }`; spread `props` onto the MUI element and guard every optional field (the JSON comes from an LLM).
2. Add a lowercase key to `componentMap` in `components/ComponentRenderer.tsx`. Add aliases as extra keys (as `input`/`textfield`/`textarea` do).
3. For clickable components, call `perFormAction(action, sendMessage, props)` with `useSendMessage({})` from `components/Chatbot/hooks/useChatActions.ts`, as `InterfaceButton` does. New action kinds go in the `perFormAction` switch.
4. Test by making a GTWY reply (or a fixture in the `Chat` slice) whose content is `JSON.stringify({ components: [{ type: "<name>", props: {…} }] })`, and check the assistant bubble.

**Change the slice**: add the reducer in `store/interface/interfaceReducer.ts`, export it from `store/interface/interfaceSlice.ts`, and add the field to `$InterfaceReduxType`. Every reducer must guard `chatSessionId` and create `state[chatSessionId]` before writing.

**Change message normalization**: edit both functions in `makeGenericDataFormatUtility.tsx` and check `Message.tsx` / `HumanOrBotMessage.tsx` in [chat-ui](./chat-ui.md), which switch on `role` and `message_type`.

Related UI catalog: [components](../ui/components.md) <!-- verify:ignore -->
