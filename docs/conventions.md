---
covers: [".eslintrc.json", "eslint.config.mjs", "next.config.ts", "package.json", "store/index.js", "store/combineReducer.js", "utils/deepCheckSelector.ts", "hoc/addUrlDataHoc.tsx"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Conventions

These are the rules the code actually follows. They replace the old AI_INSTRUCTIONS doc: its still-true rules are kept here and in AGENTS.md, and the rules the code contradicts are corrected.

## Checking your change

- `next build` does **not** type-check or lint: `next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. Run `npx tsc --noEmit` and `npm run lint` yourself.
- `.eslintrc.json` turns off `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` and `react/jsx-key`, so hook-order bugs aren't caught. An existing example is `renderIconsByType` in `components/Interface-Chatbot/ChatbotHeader.tsx`. Don't add new ones.
- There are no automated tests and no CI. Check changes by hand through a local loader script ([environment.md](environment.md)).
- The code is mixed JS and TS (`store/index.js`, `hooks/socketManager.js`, `utils/utilities.js`). Write new files in TS.

## Dependencies

- Use what's in `package.json` first: MUI + Emotion, Tailwind (+ daisyui), RTK + redux-saga, axios, dayjs, lodash helpers, uuid, react-markdown.
- Don't add a library that duplicates one already there, and don't swap Redux, socket.io, rtlayer or axios out without approval.
- `nanoid` is imported in `utils/utilities.js` but isn't in `package.json`, and there is no lockfile.

## State

| Data | Where | Why |
|---|---|---|
| Per-tab ids (current thread/channel, call token, bridge) | `appInfo[tabSessionId]` (sessionStorage, not synced across tabs) | Each tab is its own conversation. Components read it through `hoc/addUrlDataHoc.tsx` |
| Per-mount flags (`isHelloUser`, chatbot id) | `draftData` (not persisted) | Recomputed on every boot |
| GTWY messages per sub-thread | `Chat` slice (`store/chat/chatReducerV2.ts`); only `notifications` is persisted | The backend is the source of truth; history is re-fetched |
| Hello widget data, channels, unread counts | `Hello[chatSessionId]` (localStorage `persist:root`, synced across tabs) | |
| Per-chatbot GTWY config, host variables | `Interface[chatSessionId]` | |
| Tree-local UI (reply target, input ref, theme) | React Context (`ReplyContext`, `MessageContext`, `ChatContext`, `ThemeContext`, `ChatbotContext`) | Doesn't need to outlive the tree |
| Call state | `components/Chatbot/hooks/HelloVoiceService.ts` singleton, mirrored by `useCallUI` | Owned by the WebRTC SDK |

More detail is in [ui/state.md](ui/state.md). Rules:

- Don't add another global store, and don't add a parallel slice next to an existing one; extend it.
- Every reducer is keyed by `action.urlData.chatSessionId` / `tabSessionId`, which `customMiddleware` in `store/index.js` adds. A reducer without those keys does nothing.
- A **new slice** is persisted to localStorage and synced across tabs by default. Opt it out in both the root `blacklist` (`store/combineReducer.js`) and `crossTabSyncConfig.predicate` (`store/index.js`) when it is per-tab.
- Select with `useCustomSelector` (deep-equal, `utils/deepCheckSelector.ts`), not `useAppSelector`.
- Persisted state can be stale. Never treat it as the source of truth for assignment, channel ownership or call state; reconcile it from backend responses.

## Realtime and HTTP

- Use the existing connection for each backend:
  - Hello: `hooks/socketManager.js` (`subscribe` / `unsubscribe`)
  - notifications: `hooks/notifications/notificationSocketManager.ts`
  - GTWY: the rtlayer client in `components/Chatbot/hooks/useRtlayerEventManager.tsx`

  Never open another connection.
- Socket handlers only move data into the store. Routing and assignment decisions belong to the backend.
- Every send is HTTP; sockets carry inbound events, subscribe calls and typing. Don't change that model without direction.
- Every `config/helloApi.ts` function swallows its error (toast, then `null` or `[]`), so check the return value. Don't rely on try/catch.
- New hosts must come from an env var or a `config/regionConfig.ts` getter (`getHelloHostUrl`, `getSocketUrl`), never a literal. The stage literals that already exist in `config/regionConfig.ts` are the one sanctioned switch, driven by `?env=stage`. Don't add new switches, and don't infer the environment from the hostname.

## Public interface (host sites depend on it)

- Edit all three copies of a loader script together: `public/chat-widget.js` / `-dev` / `-local`, `public/chatbot*.js` and `public/rag-*.js`. Nothing generates them.
- Never rename `window.*` globals, `ParentEventType` values (`utils/emitEventsToParent/emitEventsToParent.tsx`), host→iframe message types or script file names. Add new ones instead ([api.md](api.md)).
- A new iframe→host event needs a `ParentEventType` value. If the loader script must react to it, it also needs a `case` in every Hello script's `handleIncomingMessages`; the script ignores unknown types. If only customer code listens, no script change is needed ([recipes.md](recipes.md)).

## Rendering safety

Several message paths put HTML into the page with `dangerouslySetInnerHTML`, and the push-notification shadow DOM even runs scripts ([modules/chat-ui.md](modules/chat-ui.md)). Don't send new untrusted content down those paths. `InterfaceTable` runs code taken from bot JSON ([modules/interface-renderer.md](modules/interface-renderer.md)).

## Refactoring and docs

- Make incremental changes. Don't rename files or public interfaces, or rewrite working logic, just for style.
- When you change behaviour a doc describes, update that doc in the same PR.

## Branching and release

Recent merged PRs show this flow:

1. Each change ships as **two PRs**:
   - `feature/test/<slug>` (or `H####-test`) → `test`, the test environment, titled `TEST = …`
   - `feature/react-main/<slug>` (or `H####-react-main`) → `react-main`, production, titled `MAIN = …`

   Use `bugfix/...` in place of `feature/...` for fixes.
2. `sync-test-prod-<date>` PRs bring the two branches back in line from time to time.
3. A PR opened against the wrong branch is reverted and opened again (#478 → #479 → #480).

> [!WARNING]
> GitHub's default branch `main` (last merged 2025-04-30) and `stage` (2025-05-07) are stale. Don't target them.

> [!TODO] Needs a human: confirm that `test` → test environment and `react-main` → production map to the Cloudflare Pages projects, and which branch new work should be cut from.
