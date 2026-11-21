---
covers: ["components/Chatbot/hooks/HelloVoiceService.ts", "components/Chatbot/hooks/useCallUI.ts", "components/Hello/callUI.tsx", "components/Hello/CallUI.css", "components/Interface-Chatbot/CallButton.tsx", "components/Interface-Chatbot/Messages/VoiceCallMessage.tsx"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Voice calling

Browser-to-agent (and bot) voice calls over WebRTC, using the `msg91-webrtc-call` package. A singleton service wraps the WebRTC client, a hook mirrors its state into React, a banner shows the call controls, and finished calls appear in the chat as `voice_call` messages. Calls exist only when the widget-info flag `voice_call_widget` is true.

| File | Role |
|---|---|
| `components/Chatbot/hooks/HelloVoiceService.ts` | Singleton `HelloVoiceService` (default export `helloVoiceService`). Owns the WebRTC client, the current call, call state, direction, call id, mute. Emits `callStateChanged`, `muteStatusChanged` and the relayed `call-completed` on a Node `EventEmitter` |
| `components/Chatbot/hooks/useCallUI.ts` | `useCallUI`: subscribes to the service, exposes state and actions to components, writes the call id to Redux for rejoin |
| `components/Hello/callUI.tsx` | `CallUI` banner (incoming / calling / ongoing), the `<audio>` element that plays the remote stream, and `CallTimer` |
| `components/Hello/CallUI.css` | Ripple animation, timer, hover and end-button styles used by `CallUI` |
| `components/Interface-Chatbot/CallButton.tsx` | Phone button in the text field. Checks the flag, peer channel and merged widget, asks for mic permission, starts the call |
| `components/Interface-Chatbot/Messages/VoiceCallMessage.tsx` | Renders a `voice_call` chat message: status dot, linkified text, duration |

Outside these files: init and rejoin live in `components/Chatbot/hooks/useHelloEffects.ts` (see [hello-api](../integrations/hello-api.md#init-sequence)); the second "Call Us" entry point is `components/Interface-Chatbot/ChatbotDrawer.tsx`; `CallUI` is mounted in `components/Chatbot/Chatbot.tsx`; socket handling of `voice_call` messages is in `hooks/socketEventHandler.ts` (see [realtime](realtime.md)); rendering dispatch is in `components/Interface-Chatbot/Messages/Message.tsx` (see [components](../ui/components.md)).

## How it works

### Tokens: two different ones

| Name in code | What it is | Where it comes from | Where it is kept |
|---|---|---|---|
| `HelloClientToken` | Client JWT that authenticates the WebRTC client | `config/helloApi.ts:getClientToken` → `GET /web-rtc/get-client-token/`, field `jwt_token` | localStorage via `setLocalStorage` (widget-prefixed), read by `HelloVoiceService.initialize` |
| `call_jwt_token` | Per-call token passed to `webrtc.call()` | The response of the send-message call that creates the `voice_call` message (`config/helloApi.ts:sendMessageToHelloApi`, `POST /v2/send/`). Not a separate request | Not stored. Passed straight to `initiateCall` |
| `callToken` (Redux) | **The call id**, not a token. Used only to rejoin | `data.id` of the call's `answered` event | `appInfo[tabSessionId].callToken`, persisted to sessionStorage |

`config/helloApi.ts:getCallToken` (`GET /web-rtc/get-call-token/`) still exists but has no caller; commit 4093601 ("Ticket Creation when call us") replaced it with `call_jwt_token` from the send response, so starting a call also creates the chat/ticket it belongs to.

### Initialization (on widget boot)

1. `useHelloEffects` step 5 runs only when a client id (`a_clientId` or `k_clientId`) exists, a widget token exists and widget-info returned `voice_call_widget` truthy.
2. It awaits `getClientToken()`, which stores `HelloClientToken`, then calls `helloVoiceService.initialize()`.
3. `initialize` closes any previous client, reads `HelloClientToken` (returns silently if absent), creates `WebRTC(clientToken, WebRTC_environment)` and listens for `call` with `handleCall`.
4. If Redux holds a `callToken` for this tab, it posts `OPEN_CHATBOT` to the host page and calls `rejoinCall(callToken)`.

### Outgoing call

Two entry points, both call `useOnSendHello` with `voiceCall: true` and then `helloVoiceService.initiateCall(data?.call_jwt_token || '')`:

- `components/Interface-Chatbot/CallButton.tsx:CallButton` (text field). First runs `getUserMedia({ audio: true })` and stops the tracks; on denial it shows a toast and sends nothing (commit 7b68d49, "only make when microphone permission granted").
- `components/Interface-Chatbot/ChatbotDrawer.tsx` "Call Us" button (`handleVoiceCall`). No mic pre-check. When no channel is selected it picks the first channel in the list (or the first team) and passes it as overrides, so the call lands on the most recent conversation.

With `voiceCall: true`, `useOnSendHello` skips the empty-message guard, the widget form, the loading state and the reply timeout timer; `sendMessageToHelloApi` sends `message_type: "voice_call"`.

Then:

1. `initiateCall(token)` returns early with a console warning if the client is not initialized or the token is empty. Otherwise `webrtc.call(token)`; on resolve it sets `ringing` / `outgoing` and emits.
2. The library emits `call`. `handleCall` stores the call, sets `ringing`, emits `callStateChanged` with `direction` and `callId`, and attaches the per-call listeners below.
3. `answered` → `connected`, emitted with `data`. `useCallUI` stores `data.id` as `callToken` in Redux.
4. `connected` → `connected`, emitted with the remote `mediaStream`. `useCallUI` wraps it as `{ key: Date.now(), mediaStream }` and `CallUI` sets it as the `<audio>` `srcObject` and calls `play()`.
5. `ended` or `error` → `resetCall()`: state `idle`, direction and id cleared, unmuted. `useCallUI` clears `callToken`. `error` also shows `errorToast`.

### Incoming call (agent → client)

Added in commit c5affbb ("incoming call support for web call"). `handleCall` sees `call.type === "incoming-call"`, sets direction `incoming`, and posts `OPEN_CHATBOT` to the host page because the banner lives inside the iframe. `answerCall` calls `call.accept()` only when ringing and incoming. `rejectCall` / `endCall` use `call.reject()` while an incoming call is ringing, else `call.hang()`.

### Rejoin after reload

1. While a call is connected, `appInfo[tabSessionId].callToken` holds the call id. The `appInfo` slice is persisted with redux-persist to sessionStorage (`store/combineReducer.js`, key `appInfo`), and `tabSessionId` is built from `tab_session_id` in sessionStorage (`app/chatbot/page.tsx`). So the id survives a reload of the same tab and is not seen by other tabs.
2. On boot, `rejoinCall(callId)` sets state `ringing` (direction null, so the banner shows "Calling...") and calls `webrtc.rejoinCall(callId)`. A rejected promise resets to `idle`.
3. The library's `rejoined` event sets state `rejoined` with `data.summary`. `useCallUI` keeps `summary` as `rejoinSummary`, and `CallTimer` starts from `summary.answeredAt` so the timer continues instead of restarting at 00:00.

The `rejoined` listener is attached inside `handleCall`, so rejoin only reaches the `rejoined` state if the library emits `call` for the rejoined call first.

### Mute

`toggleMute` calls `call.mute()` / `call.unmute()`. The service flips `isMuted` only when the library echoes `mute` / `unmute`, then emits `muteStatusChanged`.

### Call messages in the chat

- `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` maps any message with `message_type: "voice_call"` to `role: "voice_call"` (history and live), whoever sent it.
- `hooks/socketEventHandler.ts` adds a live `voice_call` message only for `content.status` of `completed`, `no_answer` or `in-progress`, bumps unread and moves the channel to the top. On `completed` in the open channel it calls `helloVoiceService.emitEvent('call-completed', {})`; `useHelloEffects` listens and refetches history (commit b252a29, "voice call history issue in channel list").
- `components/Interface-Chatbot/Messages/Message.tsx` renders `role: "voice_call"` with `VoiceCallMessage`. The drawer's channel preview labels it "Voice Call".

## Contracts

`callStateChanged` payloads (all fields optional except `state`):

```ts
{ state: "idle" | "ringing" | "connected" | "rejoined",
  direction?: "incoming" | "outgoing" | null,   // set by handleCall, initiateCall, resetCall
  callId?: string | null,                        // handleCall, resetCall
  callType?: string,                             // handleCall only
  data?: { id?: string, summary?: { answeredAt?: number | string } }, // answered, rejoined
  mediaStream?: MediaStream }                    // connected
```

`muteStatusChanged`: `{ muted: boolean, uid?: string }`. `call-completed`: `{}`.

`useCallUI()` returns `callState`, `callDirection`, `callId`, `isMuted`, `mediaStream` (`{ key, mediaStream }`), `rejoinSummary`, and actions `makeCall`, `answerCall`, `rejectCall`, `endCall`, `toggleMute`. Each component that calls it gets its own React state, kept in sync by the emitter; initial values come from the service getters on mount.

`VoiceCallMessage` reads:

```ts
message.content = {
  status: "completed" | "no_answer" | "in-progress" | string, // missing → renders nothing
  text: string,          // rendered as HTML after linkify
  duration?: number,     // seconds, preferred (rounded up)
  start_time?: string, end_time?: string // fallback for duration
}
```

Status dot is green for `completed`, red otherwise. Duration shows only when > 0.

### Call UI states (`components/Hello/callUI.tsx:CallUI`)

| `callState` | `callDirection` | Shown |
|---|---|---|
| `idle` | any | nothing (component returns null) |
| `ringing` | `incoming` | "Incoming call", ripple, Accept (`answerCall`) and Reject (`rejectCall`) |
| `ringing` | `outgoing` or null | "Calling...", ripple, End (`endCall`) |
| `connected` / `rejoined` | any | "Ongoing Call", `CallTimer`, mute toggle, End, `<audio autoPlay>` |
| `ended` | any | nothing. The service never emits `ended`; calls go straight to `idle` |

The banner slides in 50 ms after leaving `idle`. It is full width on small screens, half width otherwise.

### Call button availability

`CallButton` renders nothing when any of these holds: `widgetInfo.voice_call_widget` is falsy; the current channel has `is_peer_channel` (widget-to-widget chat, commit 17706c8); `getMergeParams()` contains `flow_origin` (merged widget, commit df2f79a). It is greyed out and ignores clicks while `callState !== "idle"`, so only one call runs at a time. The drawer "Call Us" button checks only `voice_call_widget` and `isMergedWidget`, plus the same idle rule.

## Gotchas

> [!WARNING]
> The WebRTC environment looks inverted. `components/Chatbot/hooks/HelloVoiceService.ts:WebRTC_environment` is `'prod'` when the iframe URL has `?env=stage` and `'test'` otherwise, so the production widget (no `env` param) uses `'test'`. Everywhere else `env=stage` means staging (`config/regionConfig.ts`). Commit 1b52a96 ("stage env handling for WEBRTC calling") introduced it; before that it was hard-coded `'test'` (commit 6de202b) and `'dev'` (commit b40c569). Do not "fix" it without confirming with the MSG91 WebRTC team what the package's `test` and `prod` point to.

> [!TODO] Needs a human: in `msg91-webrtc-call`, which backend do `'test'` and `'prod'` connect to, and is `env=stage → 'prod'` intended?

> [!WARNING]
> Redux `callToken` is the call id (from `answered`), not a JWT. Never pass `call_jwt_token` to `rejoinCall` or the call id to `initiateCall`.

> [!WARNING]
> Outgoing `call` events are ignored in hidden tabs (`handleCall` returns when `document.visibilityState === "hidden"`). `HelloClientToken` is in localStorage, so every open tab creates a WebRTC client with the same token and receives the same `call` event; this check stops two tabs playing the same call ("double voice temp fix", commit 5fc1de0). It is a temporary fix: incoming calls are not filtered, so they ring in every open tab. A rejoin in a tab that is hidden at boot can stay on "Calling..." because the call is ignored.

> [!WARNING]
> The `<audio>` element lives inside `CallUI`, and `components/Chatbot/Chatbot.tsx` unmounts `CallUI` while the notification list is shown. On remount `useCallUI` starts with an empty `mediaStream` and nothing re-attaches the stream (`getMediaStream()` exists but has no caller), so remote audio may stop until the next `connected` event.

> [!WARNING]
> `useCallUI().makeCall` calls `initiateCall()` with no token, which only logs "No call token found." Start calls through `useOnSendHello({ voiceCall: true })` and `initiateCall(data.call_jwt_token)` as the two entry points do.

> [!WARNING]
> `VoiceCallMessage` renders `content.text` with `dangerouslySetInnerHTML` after `linkify` (linkify-html does not escape). It trusts the Hello server to send safe text.

- `initialize` re-creates the client every time it is called (`if (this.webrtc) this.webrtc.close(); this.cleanUp();` has no braces; `cleanUp` always runs). The comment "Only initialize if not already done" is stale. Re-creating is deliberate: commit 21193d0 switched from "return if initialized" so a changed client token (login/logout, another widget) takes effect.
- `cleanUp` does not remove the emitter's listeners on purpose (`removeAllListeners` was commented out in 21193d0); doing so would detach every mounted `useCallUI`.
- The service reads `window.location.search` at module load with no `typeof window` guard (unlike `config/regionConfig.ts`). Import it only from client code that runs in the browser.
- The `mediaStream` state carries a fresh `key` each time so the effect in `CallUI` re-runs even when the library hands back the same stream object; this fixed audio after an agent rejoins (commit 7091833).
- `connected` and `rejoined` render the same JSX at the same position, so `CallTimer` is not remounted on a switch between them and keeps its first start time.

## Why it is built this way

- **Singleton + EventEmitter, not Redux, for live call state.** The WebRTC call object and the media stream are not serializable, and several components (`CallUI`, `CallButton`, `ChatbotDrawer`) need the same state. Only the call id goes to Redux, because only it must survive a reload. `appInfo` is per tab and excluded from cross-tab sync (`store/index.js`), which keeps rejoin in the tab that owned the call.
- **Call token from the send response.** Commit 4093601 removed the separate `getCallToken` fetch on boot and the `HelloCallToken` localStorage fallback in `initiateCall`. A call now always starts by sending a `voice_call` message, which creates the chat or ticket on the Hello side and returns the token for that call.
- **Mic check before sending.** Commit 7b68d49: without it, a denied mic still created a `voice_call` message and ticket for a call that could never connect. The drawer button does not have this check.
- **Opening the host widget on incoming calls and rejoin.** The banner is inside the iframe; if the launcher is closed the user cannot see Accept or the ongoing call.
- **Rejected / removed:** a bot-call transcript UI (a CallTextField component, "Showing Call information and user can interact with bot call", commit 2e3e7a0) was reverted in 9525b9e. Hanging up calls answered in a hidden tab (5fc1de0) was commented out in hotfix 5f7dcc8 ("second time voice call break issue") and is still commented out.

> [!TODO] Needs a human: is the hidden-tab filter still needed with `msg91-webrtc-call` 2.x, and should incoming calls also be limited to one tab?

## Changing it safely

- New call state: add it to the `useState` union in `components/Chatbot/hooks/useCallUI.ts`, to the switch in `components/Hello/callUI.tsx:CallUI`, and check `CallButton` and the drawer button, which treat every non-`idle` state as busy.
- New library event: attach it inside `handleCall` so it is bound per call, and go through `resetCall` for any terminal event so Redux `callToken` is cleared (otherwise the next reload tries to rejoin a dead call).
- New entry point for starting a call: copy `CallButton.handleVoiceCall` (mic check, `useOnSendHello({ voiceCall: true })`, `initiateCall(data.call_jwt_token)`), and respect `voice_call_widget`, `is_peer_channel` and `flow_origin`.
- Changes to `voice_call` message shape: update `utils/dataConvertWrappers/makeGenericDataFormatUtility.tsx` and `hooks/socketEventHandler.ts` together with `VoiceCallMessage`.
- Manual check (no tests cover calling): start a call from both buttons with mic allowed and denied; answer and reload mid-call (timer should continue, controls should work); end from each side; open two tabs and confirm only the visible one plays audio; take an incoming call with the launcher closed; open the notification list mid-call and confirm audio continues.
