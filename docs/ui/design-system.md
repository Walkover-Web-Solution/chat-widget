---
covers: ["tailwind.config.ts", "postcss.config.mjs", "app/globals.css", "app/layout.tsx", "hoc/theme.js", "utils/themeUtility.js", "components/AppWrapper.tsx", "components/Chatbot/hooks/useColor.ts", "components/**/*.css"]
verified_at: b9ab6d6
verified_on: 2026-10-14
---
# Design system

The widget has no fixed brand: the host chooses one primary color and a light/dark/system mode at runtime, and every surface derives from those two inputs. Three layers carry them: CSS variables on `<html>`, a MUI theme rebuilt on every change, and Tailwind 3 + daisyUI 4 classes. All three are wired in `components/AppWrapper.tsx`.

## Tokens

### Static CSS variables (`app/globals.css`)

Defined for `:root` and overridden under `[data-theme="dark"]`:

| Variable | Light | Dark | Use for |
|---|---|---|---|
| `--background` | `#ffffff` | `#121212` | page/body and panel background |
| `--foreground` | `#171717` | `#ededed` | default text |
| `--message-card-background` | `#f0f0f0` | `#1f1f1f` | bot/agent message bubbles (`.message-card-backround` class) |
| `--icon-color` | `#555555` | `#ffffff` | header and toolbar icons |
| `--drawer-color` | `#ffffff` | `#1f1f1f` | side drawer background |
| `--error-color`, `--error-text-color` | `#ef4444`, `#ffffff` | same | error badges and notices |

`app/globals.css` also: hides all scrollbars, forces the body font to a system stack and the size to 16px (≥768px) or 14px (below) with `!important`, defines `.icn` (round icon hover), `.message-card-backround` (the misspelling is the real class name), `.animate-slide-left`, and removes input/select outlines.

### Runtime CSS variables (set by `AppWrapper` on `<html>`)

- `--primary-color`: the theme color as given (for example `#3366ff`).
- `--primary-rgb`: the same color as `"r g b"` for Tailwind alpha, for example `51 102 255`.

Component-scoped variables, set inline from `useColor()`: `--theme-primary` (`components/FormComponent.tsx` focus rings), `--primary-main` (lightened primary in `MessageList.tsx` and `AssistantMessage.tsx`, consumed by `components/Interface-Chatbot/Messages/Message.css`), `--apple-accent*` (`components/Hello/AppleInteractiveMessage.tsx`).

### Tailwind (`tailwind.config.ts`, Tailwind 3 via `postcss.config.mjs`)

- `darkMode: ["class", '[data-theme="dark"]']`: `dark:` variants follow the `data-theme` attribute.
- Colors: `background`, `foreground` (from the CSS vars), `primaryTheme` and `secondaryTheme` (both `rgb(var(--primary-rgb) / <alpha-value>)`). No component uses these color classes yet; the brand color reaches components through MUI and `useColor`.
- Animations: `animate-slideUp`, `animate-fadeIn`.
- Plugins: `daisyui`, `@tailwindcss/typography`. daisyUI themes: `light` and `dark` (stock, plus an extra `primaryTheme: var(--primary-color)` key that is not a daisyUI token) and `cupcake`. daisyUI picks its theme from the same `data-theme` attribute. Components use daisyUI classes such as `loading`, `input`, `select`, `btn`, `tooltip`.

> [!WARNING]
> The `@plugin "daisyui"` and `@plugin "@tailwindcss/typography"` lines at the top of `app/globals.css` are Tailwind 4 syntax. With `tailwindcss` 3 (the installed version) the plugins are loaded only by `tailwind.config.ts`. Change plugins there.

### MUI theme (`hoc/theme.js:generateTheme`)

`generateTheme(colorHex, mode)` returns `createTheme` with:

```js
palette: {
  mode,
  primary:   { main: colorHex },
  secondary: { main: colorHex },          // same color on purpose
  background: { default: dark ? "#121212" : "#f8f8f8", paper: dark ? "#1e1e1e" : "#ffffff" },
  text:       { primary:  dark ? "#ffffff" : "#000000", secondary: dark ? "#b0b0b0" : "#666666" },
}
components: MuiButton textTransform "none"; MuiIconButton color colorHex; MuiTextField focused border colorHex
```

### Derived colors (`components/Chatbot/hooks/useColor.ts:useColor`)

Reads `useTheme().palette` and returns:

| Key | Value |
|---|---|
| `primaryBgColor`, `primaryTextColor` | the primary color (kept separate so text color can diverge later) |
| `foregroundColor` | text on a primary background: `white` in dark mode, else `black` if the primary is light, else `white` (`utils/themeUtility.js:isColorLight`, luminance > 0.35) |
| `primaryGradientBg` | 3-stop 150deg gradient tinted toward white (light) or near-black (dark) (`getGradientBackground`) |
| `primaryTintColor`, `primaryHoverTintColor` | primary at 0.12/0.08 alpha (light) or 0.18/0.12 (dark) (`withAlpha`) |
| `headerHoverBg` | `rgba(0,0,0,0.12)` light, `rgba(255,255,255,0.12)` dark |

`utils/themeUtility.js` parses any CSS color through a 1×1 canvas and caches it. Outside a browser it returns `null`/`false`, so `isColorLight` is `false` during SSR.

### Component CSS files

Plain CSS imported by one component each: `components/Interface-Chatbot/Messages/Message.css` (chat rows, slide-in animations, loading indicator, `.link-text`; the only one with a `[data-theme="dark"]` rule), `components/Interface-Chatbot/InterfaceChatbot.css` (chatbot body layout, `.move-to-down-button`), `components/Hello/CallUI.css`, `components/Grid/Grid.css`, `components/Interface-Form/InterfaceForm.css`. They contain literal colors and mostly no dark variants. `components/inputCombo/inputCombo.scss` is dead (see [components](components.md#dead-code-not-imported-anywhere-at-b9ab6d6)).

## Theming

Inputs, in order of arrival (details in [app-shell](../modules/app-shell.md#theme)):

1. **Initial color:** `primary_color` from sessionStorage `helloConfig`, else `#333333`. Initial mode `light` (`app/layout.tsx` also renders `<html data-theme="light">`).
2. **GTWY:** `interfaceDetails.config.themeColor` via `app/chatbot/layout.tsx:onConfigChange` (default `#000000`). GTWY never sets the mode, so GTWY widgets are always light.
3. **Hello:** `customTheme` and `theme` (`light` | `dark` | `system`) in the `helloData` SDK config, runtime `themeColor` updates (all in `hooks/HELLO/eventHandlers/embeddingScript/embeddingScriptEventHandler.ts`), and `widgetInfo.primary_color` (`components/Chatbot/hooks/useHelloEffects.ts`).
4. **Preview:** `{ type: "themeChange", themeColor }` posted to `/chatbotpreview`.

Each input calls `ThemeContext.handleThemeChange(color)` or `handleModeChange(mode)`. `AppWrapper` then:

- resolves `system` with `matchMedia('(prefers-color-scheme: dark)')` and keeps listening;
- sets `data-theme="light|dark"` and toggles the `dark` class on `<html>` (switches the CSS vars, Tailwind `dark:`, daisyUI theme);
- writes `--primary-color` and `--primary-rgb`;
- rebuilds the MUI theme with `generateTheme(themeColor, resolvedMode)`.

The theme is not persisted: it is re-applied from host data on every load.

> [!WARNING]
> `--primary-rgb` is computed by a regex that accepts only 6-digit hex. A host color like `#fff` or `rgb(…)` leaves `--primary-rgb` unset (or at the previous color), so any `primaryTheme` Tailwind class would be wrong. MUI and `useColor` still get the right color.

> [!WARNING]
> The host color goes straight into MUI `createTheme`. MUI's color helpers parse hex, `rgb()`, `hsl()` and `color()` only; a named color such as `red` makes theme creation throw and the whole iframe falls to `app/error.tsx`. Validate or normalize host colors before calling `handleThemeChange` if you add a new source.

> [!WARNING]
> Things that ignore the theme: toasts from `components/customToast.js` (rendered in a separate React root with the default MUI theme), `CodeBlock` (always the dark Prism style; no caller passes `isDark`), `app/error.tsx` (hard-coded blue/gray Tailwind), and the component CSS files above.

## Rules

- No hard-coded brand colors. Take the primary from `useColor()` (`primaryBgColor`, `primaryTintColor`, `primaryGradientBg`) or `useTheme().palette.primary.main`, and text on it from `foregroundColor`.
- Surfaces and text use the CSS variables (`var(--background)`, `var(--foreground)`, `var(--drawer-color)`, `var(--message-card-background)`, `var(--icon-color)`) or Tailwind `dark:` variants for neutral grays. A new variable goes in both `:root` and `[data-theme="dark"]` in `app/globals.css`.
- Do not rely on the Geist fonts: `app/layout.tsx` loads them, but the body font is forced to the system stack.
- Prefer Tailwind/daisyUI classes for layout and MUI for complex inputs; do not add a new CSS file for a single component unless Tailwind cannot express it.
- Check every UI change with a light primary (for example `#f5f5f5`), a dark primary (`#000000`), and Hello `theme: "dark"`. The dark theme was added late (commits 5a8537d "implement dark theme", 845ebdf "theme bug fixes"), and many components still branch on `theme.palette.mode` by hand (for example `components/Interface-Chatbot/ChatbotDrawer.tsx`).
