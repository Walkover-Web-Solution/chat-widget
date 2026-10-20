---
covers: ["store/index.js", "hoc/addUrlDataHoc.tsx", "config/helloApi.ts", "components/Chatbot/hooks/useRtlayerEventManager.tsx", "components/Interface-Chatbot/Messages/Message.tsx"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Glossary

| Term | Meaning | In code |
|---|---|---|
| GTWY | The AI-bot product and its backend (Node and Python APIs). | `config/api.ts` |
| Hello | MSG91's human-support product (agents, teams, tickets, bots, calls). | `config/helloApi.ts` |
| `isHelloUser` | The single switch between Hello mode and GTWY mode. | `state.draftData.isHelloUser` |
| interface | Two meanings: (1) a GTWY chatbot's config record (`chatbot_id`), kept in `Interface[chatSessionId]`; (2) the JSON UI `{components: [...]}` inside an AI reply. | `store/interface/`, [modules/interface-renderer.md](modules/interface-renderer.md) |
| bridge | A GTWY AI agent, identified by its slug (`slugName`, default `root`). | `appInfo[tab].bridgeName` |
| `chatSessionId` | The widget instance key. For GTWY it is `chatbot_id`; for Hello it is the widget token, plus `_<unique_id>` when one is given. Slices are keyed by it. | `store/index.js` |
| `tabSessionId` | Composite `<chatSessionId>_<tab>`, the key into `appInfo`. In `draftData` the same name holds only the raw per-tab timestamp. | `hoc/addUrlDataHoc.tsx` |
| `urlData` | The `{chatSessionId, tabSessionId, ...appInfo}` that middleware attaches to every action. | `store/index.js:customMiddleware` |
| thread / sub-thread | GTWY: the host chooses a thread (`threadId`); sub-threads are the chats inside it. For Hello, `subThreadId` holds the channel id. | [flows/ai-message.md](flows/ai-message.md) |
| `widgetToken` | The Hello widget id. It is stored as localStorage `WidgetId` and prefixes every widget-scoped localStorage key. | `config/helloApi.ts` |
| `a_clientId` / `k_clientId` | The anonymous and known Hello client uuids. The Hello `authorization` header is `WidgetId:clientId`. | `config/helloApi.ts` |
| channel | A Hello conversation (ticket). The channel string is also the socket room. `id` is the numeric chat id. | [integrations/hello.md](integrations/hello.md) |
| peer channel | A widget-to-widget conversation (`is_peer_channel`). It has no calls and can be blocked. | `components/Interface-Chatbot/CallButton.tsx` |
| merged widget | A Hello widget whose `helloConfig` has `flow_origin` + `integration`. Teams and calling are hidden. | `config/helloApi.ts:getMergeParams` |
| demo widget | The trial-bot mode (`widgetInfo.demo_widget`). It sends `type: trial_bot` and starts fresh on reload. | [integrations/hello.md](integrations/hello.md) |
| `interfaceDetails` | URL-encoded JSON on the iframe URL. Hello sends `{isHelloUser:true}`; GTWY sends the loginuser response. | `app/chatbot/layout.tsx` |
| `interfaceLoaded` | The iframe's "ready" postMessage. The host sends config only after it. | `components/Chatbot-Wrapper/ChatbotWrapper.tsx` |
| subdomain (script) | The first label of the loader script's hostname (or the port on localhost). It namespaces `window.chatWidget[subdomain]` and DOM ids. | `public/chat-widget.js` |
| roles | Message roles `user`, `assistant`, `Human`, `Bot`, `tools_call`, `voice_call`. They decide which renderer runs. | `components/Interface-Chatbot/Messages/Message.tsx` |
| `?env=stage` | A runtime iframe URL parameter that switches to hard-coded stage hosts. | `config/regionConfig.ts` |
