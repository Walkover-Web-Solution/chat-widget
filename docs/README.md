---
verified_at: 6667018
verified_on: 2026-11-20
---
# Docs index

Written for AI coding agents and new engineers working on the `test` line of the chat widget (Next.js). Every claim was checked against the code at the commit in each file's verified_at frontmatter; run `/ai-docs check` to see what has drifted since.

| Doc | Read it when |
|---|---|
| [architecture.md](architecture.md) | First, for any change |
| [conventions.md](conventions.md) | Before adding a file, a reducer, a storage key or an API call |
| [recipes.md](recipes.md) | Shipping any change (two release lines), or adding a window method, event, message type, Hello call, reducer or socket event |
| [glossary.md](glossary.md) | A name like `chatSessionId`, `k_clientId`, `subdomain` or `callToken` is unclear |
| [api.md](api.md) | Touching the host-page JS API, `initChatWidget` keys, postMessage events, or the list of Hello endpoints |
| [environment.md](environment.md) | Running locally, building, deploying, env vars, the `?env=stage` switch |
| [modules/embed-script.md](modules/embed-script.md) | Changing `public/chat-widget*.js` or `public/urlMonitor.js` |
| [modules/app-shell.md](modules/app-shell.md) | Changing `app/`, providers, or how the iframe handles host events |
| [integrations/hello-api.md](integrations/hello-api.md) | Changing `config/helloApi.ts`, region routing, identity, or the init sequence |
| [modules/realtime.md](modules/realtime.md) | Changing the chat or notification socket, subscriptions, reconnects, co-browse |
| [ui/state.md](ui/state.md) | Changing Redux slices, persistence, cross-tab sync, or any browser-storage key |
| [ui/components.md](ui/components.md) | Changing the drawer, header, input box, message list, reply, form, toasts |
| [ui/design-system.md](ui/design-system.md) | Changing colours, dark mode, Tailwind/daisyUI/MUI theming |
| [modules/message-rendering.md](modules/message-rendering.md) | Adding or changing how a Hello message type renders, or the generic message shape |
| [modules/voice-calling.md](modules/voice-calling.md) | Touching calls, the call button or call history messages |
| [flows/widget-boot.md](flows/widget-boot.md) | Debugging "widget does not appear / does not start", or changing boot order |
| [flows/send-message.md](flows/send-message.md) | Changing how a visitor message is sent, optimistic bubbles, new-chat creation |
| [flows/receive-message.md](flows/receive-message.md) | Changing socket message handling, unread counts, history fetch |

## Older docs

These existed before this doc set. They are not verified and the scripts skip them (`superseded` in [.ai-docs.json](.ai-docs.json)). Their still-valid content has been carried into the docs above.

| Doc | Status |
|---|---|
| [VISION.md](VISION.md), [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Product drafts. "Current Implementation" and several open questions still describe the GTWY chatbot removed in 9a37b80. |
| [brainstorms/region-wise-routing-requirements.md](brainstorms/region-wise-routing-requirements.md) | Dated decision record for region routing; rationale lives on in [hello-api](integrations/hello-api.md). It wrongly says a widget-info failure returns early. |
| [legacy/ARCHITECTURE.md](legacy/ARCHITECTURE.md), [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md), [MODULE_CHAT_WIDGET.md](MODULE_CHAT_WIDGET.md), [MODULE_CHAT_WIDGET_CALLING.md](MODULE_CHAT_WIDGET_CALLING.md), [MODULE_CHAT_WIDGET_DEMO_CHATBOT.md](MODULE_CHAT_WIDGET_DEMO_CHATBOT.md), [MODULE_CHAT_WIDGET_EXPERIMENTS.md](MODULE_CHAT_WIDGET_EXPERIMENTS.md), [MODULE_CHAT_WIDGET_REPLY.md](MODULE_CHAT_WIDGET_REPLY.md) | Superseded by the docs above. `legacy/ARCHITECTURE.md` was moved there because `docs/architecture.md` and `docs/ARCHITECTURE.md` collide on case-insensitive file systems. |

## Needs a human

Open questions the code cannot answer. Each is a `[!TODO]` in the linked doc.

**Build, deploy, environments**
- How is production built and deployed, given `npm run preview` / `npm run deploy` call a script that does not exist? — [environment](environment.md)
- Which hosts serve `chat-widget.js` and `chat-widget-dev.js`, and should their intended differences stay? — [embed-script](modules/embed-script.md), [recipes](recipes.md)
- Which test widget token should be used locally? — [recipes](recipes.md)
- Is the stage notification host right, and is the `env=stage` → WebRTC `'prod'` mapping intended? — [environment](environment.md), [voice-calling](modules/voice-calling.md)
- Why are `ignoreBuildErrors` / `ignoreDuringBuilds` on, and can they be turned off? — [app-shell](modules/app-shell.md)

**Security**
- Should the iframe check `event.origin` / `event.source` on incoming postMessages? — [app-shell](modules/app-shell.md)
- Is the hard-coded CobrowseIO license in the public embed script meant to be public? — [embed-script](modules/embed-script.md)

**Behaviour that looks unintended**
- On widget-info failure the host tears the widget down while the iframe continues. Which is intended? — [widget-boot](flows/widget-boot.md)
- Does Hello always echo `widget_msg_id` as the message `id` (needed to replace the optimistic bubble)? — [send-message](flows/send-message.md)
- Is more than one widget per host page supported (unprefixed sessionStorage keys collide)? — [state](ui/state.md)
- Why does the notification socket not re-subscribe after a reconnect? — [realtime](modules/realtime.md)
- Is the co-browse 403 (H3385) still open, and why was its fix reverted? — [realtime](modules/realtime.md), [embed-script](modules/embed-script.md)
- Is the hidden-tab filter for calls still needed, and should incoming calls ring in only one tab? — [voice-calling](modules/voice-calling.md)
- Drawer "Call Us" switches `currentTeamId` to the first team even with a channel selected. Intended? — [components](ui/components.md)

**History and cleanup**
- Why were several commits reverted without a reason (H3385, carousel and multi-widget on `react-main`, minimize button)? — [recipes](recipes.md)
- Full list of `message_type` and interactive `type` values Hello sends, per channel. — [message-rendering](modules/message-rendering.md)
- Is `getCallToken` (no callers) safe to delete? Can the debug `console.log` in `getRoutingRegion` go? — [hello-api](integrations/hello-api.md)
- Is the light-mode gradient strength a product decision? — [design-system](ui/design-system.md)
