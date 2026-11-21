---
covers: ["public/chat-widget.js", "public/chat-widget-dev.js", "public/chat-widget-local.js", "hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts", "utils/emitEventsToParent/emitEventsToParent.tsx", "components/Hello/RenderHelloInteractiveMessage.tsx", "components/Hello/AppleInteractiveMessage.tsx", "components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx", "components/Interface-Chatbot/Messages/MessageType.ts", "components/Interface-Chatbot/Messages/RepliedMessage.tsx", "components/Interface-Chatbot/ChatbotDrawer.tsx", "utils/dataConvertWrappers/**", "config/helloApi.ts", "components/Chatbot/hooks/useHelloEffects.ts", "components/Chatbot/hooks/useHelloIntegration.ts", "store/hello/**", "store/draftData/draftDataSlice.ts", "store/index.js", "types/hello/HelloReduxType.ts", "types/reduxCore.ts", "hooks/socketEventHandler.ts"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Recipes

Step-by-step for the changes this repo sees most often. Each recipe was learned from real commits and checked against the code at `6667018`. The area docs hold the details; these recipes give the order and the step people forget.

## Ship any change: two branches, two PRs

This repo has two live lines of the same Next.js app. Every change is made twice.

<!-- verify:ignore-start -->
| Branch | What it is | PRs come from | PR title prefix |
|---|---|---|---|
| `test` | Test line. This doc set describes it. 308 commits ahead of `react-main` at `6667018`. | `feature/test/<slug>`, `bugFix/test/<slug>`, `improvement/test/<slug>`, `style/test/<slug>`, or `<TICKET>-test` (e.g. `H3325-test-v1`) | `TEST = ...` / `Test = H3325 \| ...` |
| `react-main` | Production line ("Production Deployment" PR #441 targets it). | the same names with `react-main` or `main` in place of `test` (`feature/react-main/<slug>`, `bugfix/main/<slug>`, `H3325-main-v1`, `H3154-react-main`) | `MAIN = ...` / `Main = H3325 \| ...` |
| `main` | The old Angular widget. Last merge 2025-04-30. GitHub's default branch, but do not target it. | — | — |
| `stage` | Stale (last merge 2025-05-07). The stage *backend* is chosen at runtime with `?env=stage`, not by this branch. | — | — |
<!-- verify:ignore-end -->

1. Cut a branch from `test`, make the change, open a PR into `test` titled `TEST = <what>`. Example pair: PR #470 (`17706c8` "TEST = W2W Communication, Socket events, blocking chat and call (#470)") and its twin PR #469 into `react-main`.
2. After it is checked on test, cut a **second** branch from `react-main` and re-apply the change there (cherry-pick or redo). Open a PR into `react-main` titled `MAIN = <what>`.
3. Now and then `react-main` fixes are brought back with a sync PR into `test` (`3bf6f8f` "TEST - MAIN sync 11 sep 2026 (#462)").

> [!WARNING]
> Never open a PR from a branch cut from `test` into `react-main`. The two lines have diverged (210 commits on `react-main` are not on `test`, and `test` has removed the GTWY chatbot in `9a37b80`), so the PR drags unrelated test-only work into production. It happened once: PR #478 (branch `H3325-test` into `react-main`) was merged, reverted by PR #479, and redone from `H3325-main-v1` as PR #481.

### Check it works (no tests exist)

There is no test suite. `next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds`, so `npm run build` passes with type and lint errors.

```bash
npx tsc --noEmit        # types
npm run lint            # eslint
npm run dev             # app on http://localhost:3000
```

Then make a host page on another origin (any static server) that loads the local embed script from the dev server and calls `initChatWidget` with a test widget token:

```html
<script src="http://localhost:3000/chat-widget-local.js"></script>
<script>
  window.chatWidget["3000"].initChatWidget({ widgetToken: "<test widget token>", hide_launcher: false }, 0);
</script>
```

`public/chat-widget-local.js` takes the port of its own URL as the "subdomain" and loads the iframe from `http://localhost:<port>/chatbot`. Port `3001` is a legacy subdomain (flat `window.chatWidget.*` methods, `hello-` id prefix); any other port is namespaced as above. Add `?env=stage` to the host page URL to send the iframe to the stage Hello backend. Watch two consoles: the host page (embed script) and the iframe (React app). For multi-widget and small-screen checks see [embed-script](modules/embed-script.md#changing-it-safely).

> [!TODO] Needs a human: which test widget token should agents use locally, and which hosts serve `chat-widget-dev.js` and `chat-widget.js`?

## Add a window API method (host page → iframe event)
Example commits: `0eea0bb` "tickeing view and custom events handling" (`showTicket`, `getTicketUnreadCount`), `d4fd26b` "feat: enhance chatbot input handling with prefill support and message dispatch improvements (#480)" (`openWithMessage` arguments).

1. Add the method to `windowMethods` in `public/chat-widget.js`. It posts `{ type, data }` to the iframe through `sendMessageToChatbot`:
   ```js
   myMethod: (arg) => sendMessageToChatbot({ type: "MY_EVENT", data: { arg } }),
   ```
2. Make the same edit in `public/chat-widget-dev.js` and `public/chat-widget-local.js`. Run `diff public/chat-widget.js public/chat-widget-dev.js` and check that only the intended differences remain ([embed-script](modules/embed-script.md#prod-dev-and-local-copies)).
3. Register the iframe handler: write a `handleX(event: MessageEvent)` function inside `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:useHandleHelloEmbeddingScriptEvents` and add `eventHandler.addEventHandler('MY_EVENT', handleX)` in the `useEffect(..., [])` at the bottom. Without it, `hooks/CORE/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts:isEventAllowed` drops the message silently.
4. Inside the handler, read Redux values and callbacks through refs (`channelListRef`, `companyIdRef`, `onSendHelloRef`). Handlers are registered once, so a value read directly is frozen at first render. If the value may not be loaded yet, queue the request and replay it when it arrives, as `pendingInitialMessageRef` and `pendingGreetMessageRef` do.
5. If the event must store something, add a field (see [Add a Redux field](#add-a-redux-field-or-reducer-action)); `d4fd26b` added `prefillInputMessage` to `store/draftData/draftDataSlice.ts` and `types/reduxCore.ts:$DraftDataReducerType`.
6. Document it in the window API table of [embed-script](modules/embed-script.md#window-api-and-postmessage-events) and in [api](api.md).
7. Check: on the local host page call `window.chatWidget["3000"].myMethod(...)` and watch the iframe react.

> [!WARNING]
> `0eea0bb` added `showTicket` and `getTicketUnreadCount` to `public/chat-widget-dev.js` and `public/chat-widget-local.js` only. The production script got them five months later with `60a41de` "Support of multiple widget on a single Page". Since 2026 every feature and fix commit to the embed scripts touches all three files (only the `3bf6f8f` sync commit did not); keep it that way.

## Add an iframe → host page event
Example commits: `36fbeea` "TEST=Showing preview of message type push notification (#468)" (`LAUNCHER_MESSAGE_PREVIEW`), `0eea0bb` "tickeing view and custom events handling" (`TICKET_UNREAD_COUNT`).

1. Add the type to `utils/emitEventsToParent/emitEventsToParent.tsx:ParentEventType`. `emitEventToParent` accepts only these types (a type error, not a runtime check).
2. Call `emitEventToParent('MY_EVENT', data)` from the component, hook or reducer that knows the value. Reducers do this too: `store/hello/helloReducer.ts:setUnReadCount` emits `SET_BADGE_COUNT`.
3. Add a `case` to the switch in `handleIncomingMessages` in `public/chat-widget.js`, `public/chat-widget-dev.js` and `public/chat-widget-local.js`. The host ignores unknown types.
4. If the native mobile SDK must see it too, also forward it through `sendDataToMobileSDK` in the same three files (see [embed-script](modules/embed-script.md#mobile-sdk-channel)).
5. Check: trigger it in the iframe and watch the host page react. The host only accepts messages whose `event.source` is its own iframe, so test from inside the widget, not from the console of another frame.

## Add a Hello interactive message type
Example commits: `6f51d62` "TEST = carousel support in message type (#389)", `d95b975` "TEST = added interactive generic format support" (`location_request`), `ab9d7de` "TEST - Apple interactive message support (#464)".

1. Add a `case '<type>'` to the switch in `components/Hello/RenderHelloInteractiveMessage.tsx:RenderHelloInteractiveMessage` (inside `renderInteractiveContent`). The switch key is `messageJson.type || messageJson.category || message.message_type`. Put a large renderer in its own function in the same file, as `CarouselMessage` is.
2. Read both payload shapes: `action` and `actions`, and `content.interactive || content`. Generic and legacy WhatsApp-style payloads both reach this switch ([message-rendering](modules/message-rendering.md#gotchas)).
3. Option clicks call `sendMessageToHello(title)` with `e.stopPropagation()`. That sends a normal visitor message with `replied_on` set to the interactive message.
4. Give the conversation list a preview: `components/Interface-Chatbot/ChatbotDrawer.tsx` shows `body.text`, then `getAppleInteractivePreviewText`, then "Interactive Message". Extend it if your type has no `body.text`.
5. If the type needs fields that Hello sends outside `content`, add them to every return branch of both converters in `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` (`convertChatHistoryToGenericFormat`, `convertEventMessageToGenericFormat`), and to the memo deps of `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx:MessageContent` if the renderer reads them.
6. For an Apple Messages type, work in `components/Hello/AppleInteractiveMessage.tsx` instead (`detectAppleInteractiveType`, `getAppleInteractivePreviewText`); make sure a WhatsApp payload with the same type name still returns `null` there.
7. A brand-new top-level `message_type` (not an interactive sub-type) goes in `components/Interface-Chatbot/Messages/MessageType.ts:MESSAGE_TYPES`, `MessageContent`, and `components/Interface-Chatbot/Messages/RepliedMessage.tsx`.
8. Check: load a channel whose history contains the type, then receive the same type live. Both paths must render the same, in light and dark theme, and the quoted reply of it must render.

> [!WARNING]
> Set colours explicitly on cards that sit inside the bubble. Carousel cards inherited the bubble foreground and became unreadable (`89c2fb7` "TEST: carousel color issue fix", PR #453/#454), and a renderer that read an undefined `backgroundColor` needed `e99a0a0` "TEST = bug fix backgroundColor not defined".

## Add a Hello API call
Example commits: `0000753` "add greeting and domain" (`getGreetingQuestions`, `addDomainToHello` + `setGreeting`), `a3cbac3` "region-wise api calling (#458)" (`getRoutingRegion` as the first init step).

1. Add an exported async function to `config/helloApi.ts`. Use `HELLO_HOST_URL()` (region-aware, resolved on each call) and the shared `axios` from `utils/helloInterceptor.ts`, never a new axios instance or a hard-coded host.
2. Pick the `authorization` header form from [hello-api](integrations/hello-api.md#connection): `getAuthorization()` once a client id exists, the bare `WidgetId` before that. Send `user_data: getUserData()` like the other calls.
3. Catch inside the function, `errorToast(...)` if the user should know, and return `null` or `[]`. Callers check the return value; they never see a rejection.
4. Call it from the hook that owns the moment: boot-time calls go in `components/Chatbot/hooks/useHelloEffects.ts:useHelloEffects` (inside `initializeHelloServices`, after `getRoutingRegion`); send/history/channel calls go in `components/Chatbot/hooks/useHelloIntegration.ts`; one-off UI calls can live in the component (`components/Hello/RenderHelloFeedbackMessage.tsx` calls `submitFeedback`).
5. Store the result with a Hello reducer (next recipe) if other components need it.
6. Check: in the iframe's Network tab, confirm the request goes to the region host and carries the expected `authorization`; repeat with an anonymous visitor and with a `unique_id` visitor, and with `?env=stage`.

> [!WARNING]
> A boot-time call placed before `getRoutingRegion` hits the env default host, not the widget's region (`a3cbac3`). A call that uses `getAuthorization()` before a client id exists sends `<WidgetId>:null`.

## Add a Redux field or reducer action
Example commits: `4c1fb62` "feat(chatbot): handle chat session closure" (`setChannelClosedStatus`), `17706c8` "TEST = W2W Communication, Socket events, blocking chat and call (#470)" (`addChannel`, `setChannelBlockedStatus`, `Channel.is_blocked`), `d4fd26b` (draftData `prefillInputMessage`).

1. Add the field to the type: `types/hello/HelloReduxType.ts` (`$HelloReduxType`, `Channel`), `types/appInfo/appInfoReduxType.ts`, or `types/reduxCore.ts:$DraftDataReducerType`.
2. For a plain value, reuse the existing merge actions (`setHelloKeysData`, `setDataInAppInfoReducer`, `setDataInDraftReducer`). Write a new reducer only when you need logic.
3. A new Hello reducer goes in `store/hello/helloReducer.ts:reducers` and reads its key from `action.urlData?.chatSessionId`, guarding on it (see `setChannelClosedStatus`). Never take the key from the payload; `store/index.js` stamps `urlData` on every action.
4. **Export the action** from the destructuring list in `store/hello/helloSlice.ts`. This is the step that gets forgotten: every Hello reducer commit (`0000753`, `4c1fb62`, `17706c8`) edits this file.
5. Decide cross-tab behaviour. `Hello/*` actions are broadcast to the widget's other tabs by `store/index.js:crossTabSyncConfig`, and the `Hello` slice is persisted. If each tab already produces the action itself (socket events, counters), it will be applied twice; exclude it in the predicate, as `Hello/setUnReadCount` increments are. `appInfo`, `draftData` and `Chat` are neither synced nor (except `appInfo` in sessionStorage and `Chat.notifications`) persisted ([state](ui/state.md#cross-tab-sync-redux-state-sync)).
6. Check: dispatch it, then reload the iframe (rehydrate) and open a second tab of the same widget (sync).

> [!WARNING]
> Pass `channelId` explicitly to `setUnReadCount`, `changeChannelAssigned` and `setChannelClosedStatus`. Their default reads `Hello[chatSessionId].currentChannelId`, which is never set (the current channel lives in `appInfo`), so the default silently matches nothing.

## Handle a new socket event
Example commits: `17706c8` "TEST = W2W Communication, Socket events, blocking chat and call (#470)" (`block`, `new-channel`), `4c1fb62` "feat(chatbot): handle chat session closure" (reacting to `chat` and `feedback`).

1. Add a `case '<type>'` to the `switch (type)` in `hooks/socketEventHandler.ts:useSocketEvents`. The payload is the inner `message` of the `NewPublish` response; act only when `message.new_event` is true, like the other cases.
2. Add or reuse a reducer for the state change (previous recipe), passing `channelId: channel` explicitly.
3. If the event introduces a channel, subscribe through `socketManager.subscribe([channel])` so it is resubscribed on reconnect, and call `fetchChannels()` if the event lacks fields the list needs (the `new-channel` case does both).
4. Decide whether "own message" matters: use the existing `isOwnMessage` test (`chat_id` plus `client_sender_id`), not `chat_id` alone. Peer widget-to-widget messages also carry `chat_id` (`17706c8`).
5. Update the inbound table in [realtime](modules/realtime.md#inbound-events-on-the-chat-socket).
6. Check: open two tabs of the same widget, trigger the event from the Hello agent panel, and confirm both tabs update once (not twice) and that it survives a network off/on.

> [!WARNING]
> Every tab has its own socket, so each tab already receives the event. A `Hello/*` action dispatched from a socket handler is also rebroadcast to the other tabs by redux-state-sync. Counters doubled this way twice before the predicate excluded them (`7fbaa31` "bugFix -> two tab same widget same channel on tab drawer open causes twice increase in unread count of current channel", then `9339e72`).

## Rules learned from history

- **Revert by PR, then redo on a new branch.** Bad merges are undone with GitHub's revert PR (`revert-<n>-<branch>`), and the fix comes back from a fresh `-v1`/`-v2` branch: storage fallback `47d5e4a` was reverted by `542cc80`, then redone as `25f0b11` "fix: use safeStorage for blocked WebView storage (iOS WhatsApp 401)". Revert commits carry no reason in their message.
- **Never use raw `localStorage` / `sessionStorage`** in the iframe. Use `utils/utilities.js:setLocalStorage` / `getLocalStorage` or `utils/safeStorage.ts`. Blocked WebView storage in iOS WhatsApp/Instagram made every Hello call 401 (`25f0b11`).
- **Do not await or retry experiment sends** (`utils/middlewareExperiments.ts:mwSend`, `eb0af1b`).
- **Greeting buttons must not send reply metadata** (`eb41abe` "fix: skip reply metadata for greeting messages"): the greeting is a local message with a random id Hello does not know.
- **Interactive clicks must reply to their message** (`b3d7e46` "fix: send msg_id in on reply on interactive msg button clicked").

> [!TODO] Needs a human: why were `3086592` (H3385 screen sharing 403), `dbfcd6b` (carousel on `react-main`), `2f37494` (multi-widget on `react-main`) and the July 2025 minimize-button commits reverted? No reason is recorded, and the carousel and multi-widget work later landed again.
