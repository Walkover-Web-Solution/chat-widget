---
covers: [".eslintrc.json", "eslint.config.mjs", "next.config.ts", "config/helloApi.ts", "components/customToast.js", "utils/utilities.js", "utils/safeStorage.ts", "store/index.js"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Conventions

Only rules specific to this repo. General React/Next.js practice is assumed.

## Where new code goes

| Kind of code | Folder | Real example |
|---|---|---|
| Host-page behaviour (launcher, popups, window API) | `public/chat-widget.js` **and** `public/chat-widget-dev.js` **and** `public/chat-widget-local.js` | `windowMethods` |
| Handler for a host → iframe event | `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts` | `handleShowTicket` |
| Iframe → host event type | `utils/emitEventsToParent/emitEventsToParent.tsx` (`ParentEventType`) | `SET_BADGE_COUNT` |
| Hello REST call | `config/helloApi.ts` | `getAllChannels` |
| Init / send orchestration | `components/Chatbot/hooks/` | `useHelloEffects.ts`, `useHelloIntegration.ts` |
| Socket event handling | `hooks/socketEventHandler.ts` | `useSocketEvents` |
| Redux reducer | `store/<slice>/<slice>Reducer.ts`, exported from `store/<slice>/<slice>Slice.ts` | `store/hello/helloReducer.ts` |
| Redux types | `types/` | `types/hello/HelloReduxType.ts` |
| Chat UI component | `components/Interface-Chatbot/` | `ChatbotTextField.tsx` |
| Renderer for a Hello message type | `components/Hello/` | `RenderHelloInteractiveMessage.tsx` |

Step-by-step versions with the easy-to-miss registration steps are in [recipes](recipes.md).

## Layer rules

- **Embed script:** plain browser JS with no build step and no imports. Keep the three copies in step and keep only their intended differences ([embed-script](modules/embed-script.md#prod-dev-and-local-copies)). Commit `0eea0bb` changed only the dev and local copies, and production missed the feature for five months.
- **Event bridge:** handlers are registered once and close over first-render values. Read anything that changes (channel list, company id, send function) through a ref, as `useHandleHelloEmbeddingScriptEvents` does.
- **Reducers:** Hello and appInfo reducers take their key from `action.urlData`, never from the payload ([state](ui/state.md#session-ids-and-the-urldata-stamp)). A reducer that runs per tab must also be excluded from cross-tab sync in `store/index.js:crossTabSyncConfig`, or socket-driven actions apply twice (commits `7fbaa31`, `9339e72`).
- **Storage:** never touch `window.localStorage` / `window.sessionStorage` directly. Use `utils/utilities.js:setLocalStorage` / `getLocalStorage` (prefixed by the widget token) or the wrappers in `utils/safeStorage.ts`. iOS WhatsApp and Instagram webviews block storage in cross-origin iframes, and raw access sent `Authorization: null:null` (commit `25f0b11`).
- **Selectors:** use `utils/deepCheckSelector.ts:useCustomSelector` with an object-literal selector; it compares deeply so a new object each render does not re-render.

## Errors and logging

- Every function in `config/helloApi.ts` catches its own error, shows `components/customToast.js:errorToast` and returns `null` or `[]`. Callers must check the return value; a `.catch` never fires. Exceptions: `subscribeForFCMPushNotification` rethrows, `addDomainToHello` is silent, `getRoutingRegion` only logs. See [hello-api](integrations/hello-api.md#when-it-fails).
- `utils/helloInterceptor.ts` is a bare axios instance; its error interceptor is commented out. There are no retries or timeouts.
- There is no logger; `console.log` / `console.error` are used ad hoc.

## Approved libraries

| Concern | Library | Where |
|---|---|---|
| HTTP | axios, through the instance in `utils/helloInterceptor.ts` | `config/helloApi.ts` |
| State | Redux Toolkit + redux-persist + redux-state-sync | `store/index.js` |
| Realtime | socket.io-client | `hooks/socketManager.js` |
| Voice | msg91-webrtc-call | `components/Chatbot/hooks/HelloVoiceService.ts` |
| Components | MUI (theme carries the brand colour) | `hoc/theme.js` |
| Styling | Tailwind 3 + daisyUI | `tailwind.config.ts`, see [design-system](ui/design-system.md) |
| Markdown | react-markdown + remark-gfm | `components/Interface-Chatbot/Interface-Markdown/` |
| Dates | dayjs | `utils/utilities.js` |
| Toasts | own snackbar | `components/customToast.js` |

## Style the linter does not catch

Misspelled names are load-bearing; do not "fix" them in one place:

- `NEXT_PUBLIC_NOTIFICATOIN_SOCKET_URL` (env var name, see [environment](environment.md))
- `assests/` (folder), `hooks/coBrowser/CBManger.ts`, `EmbeddingScrpitEventRegistry`, `components/Hello/RenderHelloVedioCallMessage.tsx`, `components/Interface-Chatbot/Interface-Markdown/MarkdownUtitily.tsx`

Lint rules are relaxed on purpose: `.eslintrc.json` turns off `react-hooks/exhaustive-deps` and `react-hooks/rules-of-hooks`, so the linter will not warn about stale closures. Check dependency arrays by hand; several memo bugs are listed in [components](ui/components.md#rules).

## Before you finish a change

1. `npx tsc --noEmit` and `npm run lint`. `next build` will not catch type or lint errors, because `next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds`.
2. There are no tests. Check by hand: `npm run dev`, then a host page on another port that loads `http://localhost:3000/chat-widget-local.js` ([environment](environment.md#run-it-locally)).
3. Make the same change on both release lines (`test` and `react-main`) as two PRs ([recipes](recipes.md#ship-any-change-two-branches-two-prs)).
