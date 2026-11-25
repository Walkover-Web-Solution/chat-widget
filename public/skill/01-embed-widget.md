# 1. Embed the prebuilt widget

**Read this when:** the user wants Hello live chat on a website and has not asked for a custom design.
**Needs first:** nothing. Ask the user for their widget token.
**Finished when:** the launcher bubble shows, a test message reaches the Hello inbox, the reply shows in the widget.

## Install

Add the script once, near the end of `<body>` (or in `<head>` with `defer`).
Then call `initChatWidget` with the token.

`WIDGET_HOST` is the host this book came from (Base URLs table in
[SKILL.md](SKILL.md)).

```html
<script src="https://WIDGET_HOST/chat-widget.js"></script>
<script>
  initChatWidget({ widgetToken: "WIDGET_TOKEN" }, 0);
</script>
```

The second argument is a delay in ms before the launcher appears. `0` is fine.

The script creates an iframe, a launcher bubble, an unread badge and a
stylesheet. It must stay on the page; removing the `<script>` tag removes the
widget.

In React/Next/Vue, load the script in a `useEffect`/`onMounted`, then call
`window.initChatWidget(...)` once the script's `onload` fires. Never render
it on the server.

## Identify the user (optional but recommended)

Anonymous by default. To tie the chat to a logged-in user, pass identity in
the same call. Conversations then follow the user across devices, and an
anonymous chat started before login is merged into the identified one.

```js
initChatWidget({
  widgetToken: "WIDGET_TOKEN",
  unique_id: "user-123",        // your stable user id. This is the key.
  name: "Asha Rao",
  mail: "asha@example.com",
  number: "919876543210",        // no leading +
  user_jwt_token: "<signed JWT>" // only if identity verification is on, see below
});
```

Call `initChatWidget` again with no `unique_id` on logout; the widget switches
back to an anonymous session.

**Identity verification.** If the company turned it on in Hello, the
backend rejects identified sessions without a `user_jwt_token`. The user's
**server** signs a JWT carrying `unique_id` (and `mail`/`number` if sent)
with the secret from the Hello dashboard; the browser only forwards it. Never
put the secret in client code. Without a token the chat still works, but as
anonymous.

## Every option

| Key | Type | What it does |
| --- | --- | --- |
| `widgetToken` | string | Required. Company's widget token. |
| `unique_id` | string | Your user id. Makes the session identified. |
| `name`, `mail`, `number` | string | Shown to agents; prefill the contact form. |
| `user_jwt_token` | string | Server-signed identity token (see above). |
| `hide_launcher` | boolean | Hide the bubble; open it yourself with `chatWidget.open()`. |
| `launch_widget` | boolean | Open the chat window on load. |
| `show_widget_form` | boolean | Force the name/email/phone form before first message. |
| `show_close_button` / `hideCloseButton` | boolean | Show or hide the close button in the header. |
| `show_send_button` | boolean | Show a send button next to the input. |
| `icon_position` | `'left' \| 'right'` | Which corner the bubble sits in. |
| `icon_bottom_margin` | number or CSS length | Distance from the bottom edge. |
| `iconColor` | `'dark' \| 'light'` | Launcher icon color. |
| `starter_question` | boolean | Show a teaser bubble above the launcher. |
| `starter_question_text` | string | Teaser text. Default "How can I help you today?". |
| `parentId` | string | Render inline inside this element's id instead of floating. |
| `fullScreen` | boolean | Open full-screen (mobile style). |
| `theme` | `'light' \| 'dark' \| 'system'` | Color mode. |
| `sdkConfig.customTheme` | string | Primary color hex. Overrides the dashboard color. |
| `prefillMessage` | string | Text placed in the input on open. |
| `variables` | object | Key/values handed to the bot for this session. |
| `previewLinks` | string[] | URLs that open as a preview inside the widget. |
| `urlsToOpenInIFrame` | string[] | URLs the widget may open inside its iframe. |
| `pushConfig` | object | Mobile SDK only: FCM token for push. |
| `config` | `{ type, height, width, buttonName }` | Iframe size and launcher label. |
| any other key | string | Saved on the contact as a custom field (CRM data). |

Keys not in this table are forwarded as contact custom fields, so you can pass
`plan: "pro"` and agents see it.

## Dashboard settings that also apply

Widget color, logo, tagline, teams, bot, voice calls and the "hide launcher"
and "open on load" defaults come from the Hello dashboard. Page options above
override the dashboard for that page.

## Multiple widgets on one page

Each script origin registers under its own key: `window.chatWidget[<subdomain>]`.
With one widget just use `window.chatWidget` and `window.initChatWidget`.
