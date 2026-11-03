# Experiment Recording

## Overview

The chat widget can record A/B experiments for the middleware without a backend in this repository. No experiment is defined or started here. Pages keep their current UI. A page opts in later by choosing a variant locally and appending an exposure or conversion event.

The helpers live in `utils/middlewareExperiments.ts` and can be imported from any page.

## Architecture

- Variant assignment runs in the browser, synchronously, from `mwVariant()`. It is not fetched, and the page does not hide content or show a loader while deciding.
- `mwSend()` appends an event and returns immediately. Callers must not await it, chain on it, retry it, or read its response.
- Do not call `mwSend()` from a render loop, and do not call it before the visitor's own action (the variant being shown, or the goal such as a submit or navigation).
- If `NEXT_PUBLIC_MW_EVENTS_URL` or `NEXT_PUBLIC_MW_KEY` is unset, nothing is sent. Variant choice stays local.
- If assignment throws, `mwVariant()` returns the control (the first entry), or `undefined` when there is none.
- A failed send turns recording off for the rest of the page. The page does not retry.
- The request times out after 3 seconds. The page does not wait for that timeout.

## How a page uses it

```tsx
'use client'
import { useEffect } from 'react'
import { mwSend, mwVariant } from '@/utils/middlewareExperiments'

function HeroCta() {
  // During render, before anything is fetched. Variants must match the middleware, in order.
  const variant = mwVariant('hero-cta', [['control', 50], ['b', 50]])

  useEffect(() => {
    // When that variant is shown. Do not await mwSend.
    mwSend({ event: 'exposure', experiment: 'hero-cta', variant })
  }, [variant])

  return (
    <button
      onClick={() => {
        // When the visitor reaches the goal.
        mwSend({ event: 'conversion', experiment: 'hero-cta', variant, goal: 'signup' })
      }}
    >
      {variant === 'b' ? 'Try it' : 'Sign up'}
    </button>
  )
}
```

`variant` may be `undefined` when the variant list is empty. Pass the same string `mwVariant` returned into `mwSend`. This sample is not mounted. No current page calls it, and nothing on screen changes.

## Environment

Next.js only exposes public settings that use the `NEXT_PUBLIC_` prefix, which is how this app already reads browser configuration. The helpers read:

- `NEXT_PUBLIC_MW_EVENTS_URL` — public name of `MW_EVENTS_URL`
- `NEXT_PUBLIC_MW_KEY` — public name of `MW_KEY` (publishable; it can only append events)

Set both in the hosting environment and in a local `.env` to try recording. This repository has no environment example file. Do not commit the values.
