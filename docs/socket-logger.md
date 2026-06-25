# Socket Logger (Dev-Only Realtime Traffic Inspector)

A lightweight, dependency-free runtime logger that surfaces every realtime frame
the chat widget sends or receives — WebSocket, EventSource (SSE), `fetch`,
`XMLHttpRequest`, and parent ↔ iframe `postMessage`.

It is **automatically disabled in production** and is a true no-op there (no
global mutation, no console output, zero overhead).

---

## Where it lives

```
components/Chatbot/utils/socketLogger.ts
```

It is installed at **module load** (not in a React effect) from
`components/Chatbot/Chatbot.tsx`, so the wrapper is in place before any
child code can fire a fetch / XHR / postMessage:

```ts
// Chatbot.tsx — top of the file
import { installSocketLogger } from './utils/socketLogger';

// Install the dev-only realtime logger at module load (before any fetch/axios
// call can fire). The function is a true no-op in production.
installSocketLogger();
```

This guarantees that even the first axios call inside the iframe — including
the channel-list fetch that drives the launcher badge — is captured.

---

## Environment behavior

| Environment       | NODE_ENV     | Behavior                                |
|-------------------|--------------|------------------------------------------|
| Local dev         | `development`| Installed, logs to console              |
| Preview / staging | `development`| Installed, logs to console (override per build) |
| Production        | `production` | No-op — globals untouched, nothing logged |

The gate is `process.env.NODE_ENV === 'production'`. If your CI uses a different
flag (e.g. `NEXT_PUBLIC_ENV`), update the `isProd` constant at the top of
`socketLogger.ts`.

---

## What gets logged

Every frame is emitted as a `console.log` under the `[socket]` namespace, with
auto-parsed JSON when applicable.

| Kind             | Source                                     | Direction(s)               |
|------------------|--------------------------------------------|----------------------------|
| `ws`             | `new WebSocket(url)`                       | `OUT` (send), `IN` (message), `SYSTEM` (open/close/error) |
| `sse`            | `new EventSource(url)`                     | `IN` (message), `SYSTEM`   |
| `fetch`          | `window.fetch(...)`                        | `OUT` (request), `IN` (response, body ≤ 4 KB) |
| `xhr`            | `XMLHttpRequest#open / send`               | `OUT` (request), `IN` (response, body ≤ 4 KB) |
| `parent-post`    | `window.parent.postMessage(...)`           | `OUT` (from the iframe)    |
| `parent-receive` | `window` `message` listener                | `IN` (incoming postMessage)|
| `pubnub`         | (optional, see below)                      | `IN`, `OUT`, `SYSTEM`      |

Each log entry carries:
- `ts` — epoch ms timestamp
- `direction` — `in` / `out` / `system`
- `kind` — one of the rows above
- `url` — endpoint or channel
- `raw` — original payload
- `parsed` — auto-parsed JSON when `raw` was a JSON string

---

## Inspecting at runtime

Once installed (look for `[socket] Socket logger installed (dev only).` in the
console), the global is exposed:

```js
// Last 500 frames (ring buffer)
window.__socketLogger.history

// Clear console + history
window.__socketLogger.clear()

// Remove all wrappers and restore native globals
window.__socketLogger.uninstall()
```

The history frame shape:

```ts
type Frame = {
  ts: number;
  direction: 'in' | 'out' | 'system';
  kind: 'ws' | 'sse' | 'xhr' | 'fetch' | 'pubnub' | 'parent-post' | 'parent-receive';
  url?: string;
  raw: any;
  parsed?: any;
};
```

---

## PubNub hookup (optional)

If your project loads `pubnub`, attach the same logger to the instance to capture
PubNub-specific traffic:

```ts
import PubNub from 'pubnub';

const pubnub = new PubNub({ /* ...config... */ });

pubnub.addListener({
  message: (m) => console.log('[socket] IN pubnub →', m.channel, m.message),
  status:  (s) => console.log('[socket] SYSTEM pubnub →', s),
});

const origPublish = pubnub.publish.bind(pubnub);
pubnub.publish = (args: any) => {
  console.log('[socket] OUT pubnub →', args.channel, args.message);
  return origPublish(args);
};
```

This complements the wrapper logger by surfacing channel-level traffic
(PubNub frames aren't carried by `WebSocket` in the global sense).

---

## Why a no-op in production?

- Patches to `window.WebSocket`, `window.fetch`, etc. are global and would leak
  across all iframes / micro-frontends on the host page.
- Logging payloads (which can include message bodies, JWTs, customer data) would
  be a privacy / leak risk.
- The 4 KB response-body capture is fine for debugging but not desirable in
  shipped code.

The single guard inside `installSocketLogger()` prevents all of the above:

```ts
const isProd = typeof process !== 'undefined' && process?.env?.NODE_ENV === 'production';
// ...
export function installSocketLogger() {
  if (typeof window === 'undefined') return;
  if (isProd) return;
  if (window.__socketLogger) return;
  // ... wrappers installed below
}
```

---

## Troubleshooting

**Nothing logs.**
- Confirm you're not on a production build. Check `process.env.NODE_ENV` in the
  DevTools console: `(await import(/* @vite-ignore */'process')).env.NODE_ENV` or
  simply run `document.cookie` after build to see the build banner.
- Confirm the chat widget actually mounted. The install effect runs inside the
  chat widget component, so it requires `Chatbot` to render.

**`window.__socketLogger` is undefined.**
- Either `NODE_ENV === 'production'` or the effect never fired.

**Too much noise.**
- Filter in DevTools with `-/socket/i` to hide, or run
  `window.__socketLogger.uninstall()` to remove wrappers mid-session.

**`fetch` body shows up as `[object Object]`.**
- That's normal — non-string bodies (FormData, Blob, ReadableStream) are shown
  raw. Only string bodies are parsed.

---

## Related files

- `components/Chatbot/utils/socketLogger.ts` — the logger implementation
- `components/Chatbot/Chatbot.tsx` — calls `installSocketLogger()` once on mount
