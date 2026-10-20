---
covers: ["public/chat-widget.js", "public/chat-widget-dev.js", "public/chat-widget-local.js", "hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts", "utils/emitEventsToParent/emitEventsToParent.tsx", "components/Chatbot/hooks/useHelloEffects.ts", "types/hello/HelloReduxType.ts", "store/draftData/draftDataSlice.ts", "types/reduxCore.ts", "components/Interface-Chatbot/Messages/MessageType.ts", "components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx", "utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx", "config/helloApi.ts", "components/Interface-Chatbot/ChatbotHeader.tsx", "components/Interface-Chatbot/QuickActionsMenu.tsx", "package.json"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Recipes

Step-by-step for the changes this repo sees most often. Each recipe was learned from real commits and checked against the current code. Background lives in the module docs: [embed-scripts](modules/embed-scripts.md), [chat-ui](modules/chat-ui.md), [hello](integrations/hello.md).

## Ship a change (two PRs: test, then production)

Every change goes out as two PRs against two long-lived branches that do **not** share history:

| Branch | Role | Head branch names seen | PR title prefix |
|---|---|---|---|
| test | test deployment; this checkout is based on it | `feature/test/<slug>`, `bugfix/test/<slug>`, `improvement/test/<slug>`, `H<ticket>-test` | `TEST = …` (also `Test = …`) |
| react-main | production | `feature/react-main/<slug>`, `bugfix/react-main/<slug>`, `bugfix/main/<slug>`, `H<ticket>-react-main` | `MAIN = …` (also `Main = …`) |

Example pair: PR #470 (TEST) and PR #469 (MAIN) "W2W Communication, Socket events, blocking chat and call"; PR #445 and PR #446 "Subscribing channel early before first message response".

1. Branch from `origin/test`, make the change, open a PR with base `test`, title `TEST = <summary>`.
2. After it is checked on test, branch from `origin/react-main`, cherry-pick the same commits, open a PR with base `react-main`, title `MAIN = <summary>`. The MAIN PR is often merged days later and sometimes carries an extra fix commit (#469 has 2 commits, #470 has 1).
3. Always pass the base explicitly (`gh pr create --base test` / `--base react-main`).

> [!WARNING]
> The GitHub default branch is `main`, which has been dead since 2025-04-30 (last merge #149); `stage` is dead since 2025-05-07. A PR opened without `--base` targets `main` and never deploys. Do not branch from either.

> [!WARNING]
> Check the base before merging. PR #478 was a TEST change opened against `react-main` and merged to production; it was reverted the same day by PR #479 and re-done against `test` as PR #480.

> [!WARNING]
> `test` and `react-main` drift: at b9ab6d6, `origin/test` has 291 commits not in `origin/react-main` and react-main has 203 not in test. Periodic sync PRs (head `sync-test-prod-<date>`, e.g. #462 "TEST - MAIN sync 11 sep 2026") merge production-only changes back into test. Example: the `MINIMIZE_CHATBOT` event reached `test` only through that sync (3bf6f8f). Before cherry-picking to react-main, diff the touched files between the two branches; a clean cherry-pick can still depend on code only test has.

> [!TODO] Needs a human: how are test and react-main deployed (which host, triggered by what)? `package.json` has Cloudflare scripts, but `preview` and `deploy` call `npm run pages:build` while the script is named `build:pages`, so they cannot run as written.

## Add a host → iframe call (a `window.chatWidget` method)
Example commit: `8cc5d8a` "Feature -> expose function named setVariablesForBot to add variables for bot" (the method was later folded into `SendDataToBot`/`initChatWidget`); `d4fd26b` "feat: enhance chatbot input handling with prefill support…" (extends `openWithMessage`).

1. In `public/chat-widget.js`, add the method to `windowMethods`; it should call `sendMessageToChatbot({ type: '<NEW_TYPE>', data })`.
2. Apply the same hunk to `public/chat-widget-dev.js` and `public/chat-widget-local.js`.
3. In `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`, write a handler and register it in the `useEffect` with `eventHandler.addEventHandler('<NEW_TYPE>', handler)`. Validate the payload (`isPlainObject`) the way the existing handlers do: the iframe does no origin check.
4. If the data must be kept, add a field and reducer to `store/draftData/draftDataSlice.ts` and its type to `$DraftDataReducerType` in `types/reduxCore.ts` (8cc5d8a added `setVariablesForHelloBot`; d4fd26b added `prefillInputMessage`).
5. Add the type to the host → iframe table in [embed-scripts](modules/embed-scripts.md#postmessage-protocol) and to [api](api.md).
6. Check: load `chat-widget-local.js` from a static page, call the method from the console, and confirm the handler fires (React devtools / Redux).

> [!WARNING]
> An unregistered type is silently dropped by the iframe registry. A method added to only one script copy works in one environment and does nothing in the others; `31bbcbc` (open in `parentId`) changed only `public/chat-widget-local.js`.

## Add an iframe → host event
Example commits: `cc26cf6` "feature -> send event to parent on bridge switch"; `fa9bc0b` "feature -> send events to for react native download and uuid set".

1. Add the type to the `ParentEventType` union in `utils/emitEventsToParent/emitEventsToParent.tsx`.
2. Emit it with `emitEventToParent('<TYPE>', data)` from the component or hook.
3. If the Hello script must react (resize, download, badge…), add a `case` to `handleIncomingMessages` in all three `public/chat-widget*.js`. If only customer code listens (like `BRIDGE_SWITCH`, `HEADER_BUTTON_PRESS`), no script change is needed, but document it.
4. Mobile SDK: when `isMobileSDK` is set, the script forwards to native code via `sendDataToMobileSDK` (see the `downloadAttachment` case); add the forward if native apps need it.
5. Add the type to the iframe → host table in [embed-scripts](modules/embed-scripts.md#postmessage-protocol).

## Add an `initChatWidget` config option (Hello)
Example commit: `2c151ec` "feat: integrate prefill message handling in chatbot component and update state management" (`prefillMessage`); `ecea29e` "feat: intial message support in widget config…".

No script change is needed for a plain option: the script forwards the whole `initChatWidget` object as `helloData`, and `handleHelloData` stores it as `helloConfig` (Redux via `setHelloConfig`, plus sessionStorage key `helloConfig`).

1. Add the optional key to `HelloData` in `types/hello/HelloReduxType.ts`.
2. Read it per session: `state.Hello?.[chatSessionId]?.helloConfig?.<key>` (see how `components/Interface-Chatbot/ChatbotTextField.tsx` reads `show_send_button`, or `components/Chatbot/Chatbot.tsx` reads `prefillMessage`). Get `chatSessionId` from `addUrlDataHoc` props.
3. Add the key to `keysToRemove` in `components/Chatbot/hooks/useHelloEffects.ts`.
4. If the host may change it after init (`SendDataToBot`), it arrives as `helloRunTimeData`: handle it in `handleHelloRuntimeData`. If the script itself must act on it (launcher, sizing), also add it to `processDataProperties` in all three script copies.

> [!WARNING]
> Skipping step 3 sends the key to the Hello backend as a client field: every key not in `keysToRemove` goes through `saveClientDetails` (`PUT /v2/client/<clientId>`) and shows up on the customer's contact record. 2c151ec added `prefillMessage` there for this reason.

## Add a Hello message type renderer
Example commits: `d0943cd` "Feedback message handling" (new `feedback` type end to end); `ab9d7de` "TEST - Apple interactive message support (#464)" and `6f51d62` "TEST = carousel support in message type (#389)" (new variants of `interactive`).

1. Add the constant to `MESSAGE_TYPES` in `components/Interface-Chatbot/Messages/MessageType.ts` (skip for a variant of an existing type).
2. Normalize it in `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` in **both** paths: `convertChatHistoryToGenericFormat` (history API) and `convertEventMessageToGenericFormat` (socket). Payload goes in `messageJson`.
3. Create `components/Hello/RenderHello<Name>.tsx` and add a `case` to `MessageContent` in `components/Interface-Chatbot/Messages/HumanOrBotMessage.tsx`.
4. If it draws its own bubble, skip the padded card (see `isSelfContainedAppleMessage` in ab9d7de).
5. Update the other places that turn a message into text: drawer subtitle and minimized header preview ([chat-ui](modules/chat-ui.md#changing-it-safely)), and reply previews (`9c25ac4` fixed replies to Apple messages after #464 forgot them).
6. Replies from the renderer go through `useSendMessageToHello`, never `sendMessageToHelloApi` directly ([hello](integrations/hello.md#how-to-change-safely)).

## Add a Hello API call
Example commits: `508d8f9` "TEST = Read more/less functionality" (`getFullMessageApi` plus its UI); `894f176` "feat: include trial_company_id in helloApi payload for demo widgets" (payload-only change).

1. Add an exported async function to `config/helloApi.ts`. Build the URL with `HELLO_HOST_URL()` (a function: the region can change after boot), send `authorization: getAuthorization()` and `user_data: getUserData()`, toast and return `null` on error.
2. Call it from a hook (`components/Chatbot/hooks/useHelloIntegration.ts` / `useHelloEffects.ts`), not from render.
3. Add it to [api](api.md) and the summary in [hello](integrations/hello.md#calls-we-make).

> [!WARNING]
> Nothing may call Hello before `getRoutingRegion()` resolves: since `a3cbac3` (#458, region-wise routing) the host is per-region and `config/regionConfig.ts` keeps it in memory only. Rationale: `docs/brainstorms/region-wise-routing-requirements.md`.

## Add a header quick action
Example commit: `9696fcf` "TEST = Call button, UI changes" (introduced `QuickActionsMenu`).

1. Add a prop and menu item to `QuickActionsMenuProps` / `QuickActionsMenu` in `components/Interface-Chatbot/QuickActionsMenu.tsx`.
2. Compute the visibility flag in `components/Interface-Chatbot/ChatbotHeader.tsx` next to `hasMinimizeAction` and pass it in `QuickActionsMenuComponent` (add it to the `useMemo` deps).
3. If the host page must resize or react, add an iframe → host event (recipe above).
4. Check in Hello and GTWY modes, fullscreen and minimized ([chat-ui](modules/chat-ui.md#header-actions)).

> [!WARNING]
> The minimize button plus in-textarea call button was committed and reverted several times on 2025-07-09 (four `Revert` commits, e.g. `f461aa4` reverted by `d644481`) before it shipped. [!TODO] Needs a human: why were these reverted?

## Add an env var

1. Read it as `process.env.NEXT_PUBLIC_<NAME>` (client code; Next inlines it at build time), e.g. `NEXT_PUBLIC_PUSH_NOTIFICATION_URL` in `config/helloApi.ts` (added in `91c78e0`).
2. Add it to [environment](environment.md); there is no .env.example file in the repo.
3. Set it in the build environment of both the test and production deployments before merging the MAIN PR, then rebuild; a missing value is `undefined` at runtime, with no error.
