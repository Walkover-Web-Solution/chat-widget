# 3. Events the widget sends to the page

**Read this when:** the page must react to the widget (badge in your own nav, analytics on open, custom push popups).
**Needs first:** [01-embed-widget.md](01-embed-widget.md).
**Finished when:** the page handler fires for the event the user cares about.

The widget runs in an iframe and talks to the page with `postMessage`.
Listen on `window` and check `event.data.type`. Only trust events whose
`event.origin` is the widget host (the host this book came from).

```js
window.addEventListener("message", (e) => {
  if (e.origin !== "https://WIDGET_HOST") return;
  const { type, data } = e.data || {};
  if (type === "SET_BADGE_COUNT") myNav.setBadge(data?.count ?? 0);
});
```

| `type` | `data` | When |
| --- | --- | --- |
| `interfaceLoaded` | — | Widget UI is ready. Safe to call `chatWidget.*` methods. |
| `OPEN_CHATBOT` | — | Chat window opened (user click or `open()`). |
| `CLOSE_CHATBOT` | — | Chat window closed. |
| `MINIMIZE_CHATBOT` | — | User minimized. |
| `ENTER_FULL_SCREEN_CHATBOT` / `EXIT_FULL_SCREEN_CHATBOT` | — | Full-screen toggled. |
| `SET_BADGE_COUNT` | `{ count }` | Total unread across conversations changed. |
| `TICKET_UNREAD_COUNT` | `{ id, count }` | Answer to `getTicketUnreadCount`. |
| `SHOW_STARTER_QUESTION` | `{ message, options[] }` | Bot greeting is available and no chat exists yet. |
| `HIDE_STARTER_QUESTION` | — | First message sent; teaser should go. |
| `LAUNCHER_MESSAGE_PREVIEW` | notification message | A proactive "Message" push arrived; the script shows a preview bubble. |
| `PUSH_NOTIFICATION` | notification message | A "Popup"/"Custom" push arrived; render your own overlay if you want. |
| `uuid` | `{ uuid }` | The Hello client id for this visitor (use for co-browse or your analytics). |
| `ENABLE_DOMAIN_TRACKING` | — | Widget asks the script to start page-visit tracking. |
| `RELOAD_PARENT` | — | Widget asks the page to reload (after a session reset). |
| `initializeHelloChat_failed` | — | Token or network problem; the script removes the widget. See [17-errors.md](17-errors.md). |

The script already handles all of these itself (badge on the launcher, open/
close, previews). You only listen when you want something extra.
