---
covers: ["utils/themeUtility.js", "hoc/theme.js", "tailwind.config.ts", "app/globals.css", "components/Chatbot/hooks/useColor.ts", "components/Interface-Chatbot/**/*.css"]
verified_at: 6667018
verified_on: 2026-11-20
---
# Design system

The widget has one brand color, set per widget, and a light/dark mode. Everything else is derived from those two inputs at runtime. Three systems share the job:

- MUI's theme (`hoc/theme.js:generateTheme`), which carries the brand color.
- CSS custom properties (`app/globals.css`), which carry the neutral surface colors.
- Tailwind 3 with daisyUI 4 (`tailwind.config.ts`), for layout and the neutral palette.

| File | Role |
|---|---|
| `components/AppWrapper.tsx` | Owns `themeColor` and `themeMode` state, builds the MUI theme, sets `data-theme`, the `dark` class, `--primary-color` and `--primary-rgb` on `<html>` |
| `hoc/theme.js` | `generateTheme(colorHex, mode)`: MUI palette (`primary` = `secondary` = brand color), background and text per mode, overrides for button, icon button and text field |
| `components/Chatbot/hooks/useColor.ts` | The hook components should use for brand-derived colors |
| `utils/themeUtility.js` | `isColorLight`, `getGradientBackground`, `withAlpha`. Parses any CSS color through a 1x1 canvas and caches the result |
| `app/globals.css` | Neutral tokens for light and dark, body font, hidden scrollbars, `.message-card-backround`, `.icn`, `.animate-slide-left` |
| `tailwind.config.ts` | `darkMode` selector, theme colors, `slideUp`/`fadeIn` animations, daisyUI themes |
| `components/Interface-Chatbot/Messages/Message.css` | Thinking-indicator bars, `--link-text-color`, link colors inside the user bubble |
| `components/Interface-Chatbot/InterfaceChatbot.css` | `.move-to-down-button` and a few legacy layout classes |

## Tokens

**Neutral CSS variables** are defined in `app/globals.css` for `:root` and again for `[data-theme="dark"]`:

| Variable | Light | Dark | Used for |
|---|---|---|---|
| `--background` | `#ffffff` | `#121212` | page, mobile header and input row, form modal |
| `--foreground` | `#171717` | `#ededed` | body text |
| `--message-card-background` | `#f0f0f0` | `#1f1f1f` | agent and bot bubbles (`.message-card-backround`) |
| `--icon-color` | `#555555` | `#ffffff` | icons, "Closed" badge, reply-preview text |
| `--drawer-color` | `#ffffff` | `#1f1f1f` | drawer and menus |
| `--error-color` / `--error-text-color` | `#ef4444` / `#ffffff` | same | unread badges and dots |

**Brand-derived values.** Read these from `useColor()`; do not compute them yourself:

| Key | Value |
|---|---|
| `primaryBgColor`, `primaryTextColor` | the brand color. They are kept separate so the text color can diverge later |
| `foregroundColor` | text drawn on the brand color: always `white` in dark mode, otherwise `black` or `white` by luminance (`isColorLight`, threshold 0.35) |
| `primaryGradientBg` | the 150-degree gradient used by the drawer header and the active conversation row (`getGradientBackground`) |
| `primaryTintColor` / `primaryHoverTintColor` | the brand color at 0.12/0.08 alpha (light) or 0.18/0.12 (dark) |
| `headerHoverBg` | `rgba(0,0,0,0.12)` light, `rgba(255,255,255,0.12)` dark; passed down as `--header-hover-bg` |

**Variables set at runtime:**

- `--primary-color` and `--primary-rgb` are set by `AppWrapper`.
- `--header-hover-bg` is set by the header and drawer.
- `--down-btn-bg-color` and `--down-btn-text-color` are set by `MoveToDownButton`.
- `--primary-main` (the thinking bars) is set by `MessageList`.
- `--theme-primary` (form focus ring) is set by `FormComponent`.

**Tailwind:**
- `background` and `foreground` colors map to the CSS variables.
- `primaryTheme` and `secondaryTheme` map to `--primary-rgb`, but no component uses them.
- Animations: `animate-slideUp` (bottom-sheet form) and `animate-fadeIn`, plus `.animate-slide-left` defined in `app/globals.css`.
- Plugins: `daisyui` and `@tailwindcss/typography` (`prose` for markdown).

## Theming

**Brand color**, later calls win:
1. `AppWrapper` starts from session `helloConfig.primary_color`, or `#333333`.
2. On `helloData`, `sdkConfig.customTheme` from the embed script is applied (`hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`).
3. After widget-info loads, `widgetInfo.primary_color` is applied **only when there is no `customTheme`**, and is saved back into session `helloConfig.primary_color` so the next load starts with it (`components/Chatbot/hooks/useHelloEffects.ts`).
4. A `helloRunTimeData` event with `themeColor` changes it live.

**Mode:**
- `helloData` may carry `theme` (or `sdkConfig.theme`) set to `light`, `dark` or `system`. The default is `light`. `system` follows `prefers-color-scheme` and updates live.
- `AppWrapper` writes the resolved mode to `<html data-theme>` and toggles the `dark` class. `app/layout.tsx` server-renders `data-theme="light"`.
- Tailwind `dark:` variants match either the class or `[data-theme="dark"]`. daisyUI switches between its stock `light` and `dark` themes on the same attribute.

**Fixed choices:**
- Code blocks are always dark (`CodeBlock` uses `vscDarkPlus` in both modes).
- Notification iframes force `color-scheme: light`.
- Hidden scrollbars are global (`* { scrollbar-width: none }`).
- The body font is the system stack, 14 px under 768 px and 16 px above.

## Rules

> [!WARNING]
> daisyUI's `primary` is **not** the widget color. The overrides in `tailwind.config.ts` are commented out, so `text-primary`, `bg-primary`, `border-t-primary`, `link-primary` and `ring-primary` render daisyUI's stock primary in any widget. For brand color, use `useColor()` values in inline `style`, or `theme.palette.primary.main`.

> [!WARNING]
> `--primary-rgb` is set only when the brand color is a 6-digit hex (`components/AppWrapper.tsx:hexToRgb`). A 3-digit hex, `rgb()` or a named color leaves it unset, which breaks any `primaryTheme` Tailwind class. `utils/themeUtility.js` handles every CSS color, so prefer it.

> [!WARNING]
> `utils/themeUtility.js` needs `document`. During SSR `isColorLight` returns `false`, and `getGradientBackground` returns the input color unchanged. Do not cache results computed on the server.

- **Text on brand color.** Pick it with `foregroundColor` from `useColor()` (or `isColorLight`, as the send button does). Never hard-code white: light brand colors exist.
- **Dark mode.** New surfaces use `var(--background)`, `var(--drawer-color)` or `var(--foreground)`, or a `dark:` variant; check both modes. Avatars and badges in the drawer switch from the brand tint to `rgba(255,255,255,0.22)` in dark mode, because a dark brand color disappears on a dark drawer.
- **Links in the user bubble.** These inherit the bubble's text color and are underlined, because the themed link color can be the same as the bubble background (0447290). Keep the explicit state selectors in `Message.css`; they exist to outrank daisyUI's `.link-primary:hover`.
- **`@plugin` lines.** The `@plugin` lines at the top of `app/globals.css` are Tailwind 4 syntax. This repo runs Tailwind 3 (`tailwindcss: ^3.4.1`, `postcss.config.mjs`), so plugins come only from `tailwind.config.ts`; register new plugins there.

> [!TODO] Needs a human: is the light-mode gradient strength in `getGradientBackground` (`0.14 + ratio * 0.16`) a product decision, or free to tune?
