# 2. Control the widget from page code

**Read this when:** the page has to open, close, hide or feed the prebuilt widget (a "Chat with us" button, deep link to a ticket, pass CRM data).
**Needs first:** [01-embed-widget.md](01-embed-widget.md).
**Finished when:** each call the user asked for does the visible thing.

All methods live on `window.chatWidget` after the script loads.

| Call | What happens |
| --- | --- |
| `chatWidget.open()` | Opens the chat window. |
| `chatWidget.open(ticketId)` | Opens straight into that conversation. |
| `chatWidget.close()` | Closes the window; launcher stays. |
| `chatWidget.toggleWidget()` | Open if closed, close if open. |
| `chatWidget.hide()` | Hides window and launcher. |
| `chatWidget.show()` | Shows the launcher again. |
| `chatWidget.openWithMessage(text, autoSend = true, alwaysNewChat = true)` | Opens and types `text`. `autoSend` sends it; `alwaysNewChat` starts a new conversation instead of continuing the last one. |
| `chatWidget.showTicket(ticketId)` | Switches the open widget to that conversation. |
| `chatWidget.getTicketUnreadCount(ticketId)` | Promise of the unread count for one conversation (0 after 5 s if no answer). |
| `chatWidget.SendDataToBot({...})` | Updates options at runtime: any key from chapter 1 (`hide_launcher`, `parentId`, `starter_question`, `config`, `variables`...). |
| `chatWidget.addCustomData({ name, mail, number, ...fields })` | Updates the contact: name, email, phone and custom fields. |
| `chatWidget.modifyCustomData({...})` | Same as `addCustomData`. |
| `chatWidget.addUserEvent({ event: "cart_abandoned", ... })` | Records a user event on the contact (visible to agents, usable in automations). |
| `chatWidget.handlePushNotification(data)` | Mobile SDK: hand an FCM payload to the widget. |
| `chatWidget.shutdown()` | Ends the session and clears local chat data (use on logout before re-init). |

`initChatWidget(options, delay)` can be called again at any time; it merges
the new options, so it is also the way to log a user in or out.

## Common asks

- **Custom "Chat" button, no bubble:** init with `hide_launcher: true`, then
  `chatWidget.open()` on click.
- **Inline chat in a page section:** init with `parentId: "support-panel"`.
  The iframe renders inside that element.
- **Start a chat about a product:** `chatWidget.openWithMessage("I'm asking about SKU 123")`.
- **Logout:** `chatWidget.shutdown()` then `initChatWidget({ widgetToken })` with no `unique_id`.
