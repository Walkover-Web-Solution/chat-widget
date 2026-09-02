# Region-wise API & Socket Routing — Requirements

**Date:** 2026-08-11 (updated 2026-09-01: region now resolved by a dedicated `/routing-region`
API instead of widget-info)
**Status:** Decided, implemented
**Scope:** Standard (technical/architectural)

## Problem

A dedicated `POST /routing-region` API (authorization: widget token, body `{user_data}`)
returns `region_url` (REST) and `socket_url` (socket) identifying which regional backend a
company lives on — along with `country`, `company_id`, and `inbox_id`. All subsequent Hello
API calls — **including widget-info** — and the chat socket connection must go to that region.
Previously both base URLs were module-level constants read from env at import time, so region
was fixed at build time and could not vary per company; an interim version resolved the region
from the widget-info response instead.

## Decision

Hold the region in **module-level memory**, set once per page load from the routing-region
response. Do not persist it.

### Why not persist

The original framing asked to persist the region so reloads and new tabs reuse it. Two facts
from this brainstorm made persistence unnecessary and actively harmful:

1. **Any regional host can serve `routing-region` for any company** and returns that company's
   real `region_url`. There is no bootstrap-routing problem: a cold widget hitting the env
   default always gets correctly redirected. Every other endpoint (widget-info included) is
   region-locked.
2. **`initializeHelloServices` runs on every mount**, and routing-region is its first call. A
   reload is a mount; a new tab is a mount. The region is therefore always re-fetched before
   any region-locked call in exactly the scenarios persistence was meant to cover.

Storing the region can only make it *stale*; it can never make it *available when it otherwise
wouldn't be*. The "same region across reload and new tab" requirement is satisfied by
re-fetching, which is strictly more correct than remembering.

This also removes: localStorage key management, widgetToken namespacing, URL normalization and
comparison, `typeof window` SSR guards, and any cross-tab staleness reasoning.

## Requirements

- `routing-region` is the first call in the init sequence, on every widget load; `widget-info`
  runs after it, against the resolved region.
- All Hello REST calls resolve their base URL **per call**, not at module load, so a region
  arriving mid-sequence applies to everything after it.
- The socket resolves its URL **at connect time**, for the same reason.
- If the socket is already open against a different region when the region resolves, it is torn
  down so it reconnects to the correct one.
- Absent a region (before routing-region returns, or after it fails), calls use the existing
  env defaults and `?env=stage` behavior — unchanged.

## Failure behavior

A routing-region failure is non-fatal: init continues against the env defaults (the
pre-routing behavior). Widget-info failure is unchanged from existing code: init posts
`initializeHelloChat_failed` to the parent and returns early. No retry logic added.

## Scope boundaries

Out of scope:
- The notification socket (`hooks/notifications/notificationSocketManager.ts`) — widget-info
  returns no URL for it; it remains a separate global service on its own env var.
- Non-Hello hosts in `config/api.ts`.
- Cross-tab region synchronization — unnecessary, each tab resolves its own.

## Affected files

- `config/regionConfig.ts` — region state and accessors
- `config/helloApi.ts` — per-call base URL resolution; `getRoutingRegion()` sets region from
  the routing-region response
- `hooks/socketManager.js` — connect-time URL resolution; reconnect on region change
- `components/Chatbot/hooks/useHelloEffects.ts` — routing-region hoisted to first call in init,
  ahead of widget-info
