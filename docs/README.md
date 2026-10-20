---
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Docs index

Start with [../AGENTS.md](../AGENTS.md), then read the doc for the area you're changing. Every path and symbol in these docs was checked against the code at the commit in each doc's frontmatter.

## Cross-cutting

| Doc | Read it when |
|---|---|
| [architecture.md](architecture.md) | You need the big picture: loader script → iframe → Next app, the two backends, layers, the message path |
| [conventions.md](conventions.md) | You're adding state, a socket subscription, an endpoint or a public event, or opening a PR (two-PR flow) |
| [glossary.md](glossary.md) | A name is ambiguous: interface, bridge, `chatSessionId`, `tabSessionId`, channel, the client ids |
| [api.md](api.md) | You're touching the host-page JS API, the postMessage protocol, or any backend / realtime call |
| [environment.md](environment.md) | You're running locally, adding an env var, using `?env=stage`, or building for Cloudflare |
| [recipes.md](recipes.md) | You're making a common change: a host method or event, an `initChatWidget` option, a Hello message type or API call, a header action, an env var, shipping |

## Modules and integrations

| Doc | Read it when |
|---|---|
| [modules/embed-scripts.md](modules/embed-scripts.md) | `public/` loader scripts, the iframe, the postMessage handlers, the three env copies |
| [modules/app-shell.md](modules/app-shell.md) | Routes, providers, the store setup (persist, cross-tab sync, `urlData` middleware), region config, build |
| [integrations/hello.md](integrations/hello.md) | MSG91 Hello: identity, channels, `/v2/send/`, socket.io, feedback, interactive messages, calling, demo widget |
| [modules/chat-ui.md](modules/chat-ui.md) | The component tree, AI vs Hello mode, message rendering, reply, drawer, header |
| [modules/interface-renderer.md](modules/interface-renderer.md) | JSON UI (`{components: [...]}`) in AI replies, `componentMap`, actions, `/chatbotpreview` |

## Flows

| Doc | Read it when |
|---|---|
| [flows/widget-boot.md](flows/widget-boot.md) | From the host script to a ready widget, for both Hello and GTWY |
| [flows/ai-message.md](flows/ai-message.md) | An AI message from the text field to the rendered answer, including the timeout and errors |
| [flows/hello-human-chat.md](flows/hello-human-chat.md) | Hello: new chat, send, agent events, unread counts, feedback, calls |

## UI

| Doc | Read it when |
|---|---|
| [ui/routes.md](ui/routes.md) | Next pages and who loads them |
| [ui/state.md](ui/state.md) | Slices, persistence, cross-tab sync, contexts, storage keys, where state goes |
| [ui/components.md](ui/components.md) | Finding an existing component before writing one; dead components |
| [ui/design-system.md](ui/design-system.md) | Tailwind, MUI theme, CSS variables, host theme color |

Design notes: `docs/brainstorms/region-wise-routing-requirements.md`.

## Needs a human

Open questions the code can't answer. Answer them in the doc that asks, then delete the TODO.

- **Deploy and branches:**
  - which Cloudflare Pages project and branch serves `test` and `react-main`, and how deploys are triggered given the broken `preview`/`deploy` scripts ([environment.md](environment.md), [modules/app-shell.md](modules/app-shell.md), [recipes.md](recipes.md), [conventions.md](conventions.md))
  - where to get the `NEXT_PUBLIC_*` values ([environment.md](environment.md))
  - which hostnames serve the prod and dev scripts ([environment.md](environment.md))
- **Environment inversions:** why `?env=stage` selects WebRTC `prod` and the stage notification host ([integrations/hello.md](integrations/hello.md), [environment.md](environment.md)).
- **Build:** why type-check and lint are off in `next build` ([architecture.md](architecture.md)).
- **Loader scripts:**
  - why three hand-maintained copies exist
  - `public/chatbot.js` loading its iframe from localhost
  - why PR #344 was reverted

  All in [modules/embed-scripts.md](modules/embed-scripts.md).
- **Storage:** whether fully blocked storage is supported, and why #472 was reverted ([flows/widget-boot.md](flows/widget-boot.md), [modules/app-shell.md](modules/app-shell.md)).
- **AI chat:**
  - rtlayer vs socket.io, and whether the rtlayer keys are meant to be public ([flows/ai-message.md](flows/ai-message.md))
  - the JSON UI schema and the `flow.sokt.io` table pagination ([modules/interface-renderer.md](modules/interface-renderer.md))
- **UI:**
  - whether the AI/Human tab should switch modes, and whether reply should work for AI chats ([modules/chat-ui.md](modules/chat-ui.md))
  - who embeds `/chatbotpreview` ([ui/routes.md](ui/routes.md))
  - deleting the dead components ([ui/components.md](ui/components.md))
- **Other:**
  - why the minimize button was reverted ([recipes.md](recipes.md))
