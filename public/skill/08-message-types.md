# 8. Custom UI: message types and how to render them

**Read this when:** drawing the message list. Covers every `message.type` / `message.message_type` pair, every interactive payload (WhatsApp-style and Apple Messages for Business), and what to send back when the user taps something.
**Needs first:** [07-messages.md](07-messages.md).
**Finished when:** nothing in a real conversation renders as an empty bubble, and tapping any button/row/option produces the right outgoing message.

`message.type` says what kind of event it is. `message.message_type` says
how to draw it. Unknown pairs: fall back to `content.text` (or
`content.body.text`), never drop them.

## 1. `type: "chat"`: normal messages

| `message_type` | Draw | Fields |
| --- | --- | --- |
| `text` | Markdown/linkified text | `content.text`, `content.show_more` (chapter 7) |
| `attachment` | File or image cards | `content.attachment[]` (URLs; image if the URL ends in an image extension, else a download link) |
| `text-attachment` | Text plus cards | both of the above |
| `interactive` | Buttons, lists, cards, Apple sheets (sections 3 and 4) | `content.interactive` is the payload; `content.body.text` is the plain-text fallback |
| `voice_call` | A call summary card | `content.status` (`completed`, `no_answer`, `in-progress`), `content.start_time`, `content.end_time`, `content.duration` (s), `content.text` |
| `video_call` | A "Join video call" button | the meet URL is `content.text` or `content.interactive.text`; `content.interactive.expiration_time` (grey out when past) |
| `pushNotification` | Rendered HTML in an isolated container (shadow DOM / sandboxed iframe) | `content` is an HTML string. Comes from proactive notifications (chapter 15). |

**Reply quoting:** if `replied_msg_content` is present, draw a quote block
with `replied_from_name` and the replied text. When `replied_msg_type` is
`interactive`, `replied_msg_content` is the interactive payload; show its
`body.text` or a label like "Interactive message".

## 2. Other `type` values

| `type` | Draw | Notes |
| --- | --- | --- |
| `feedback` | A CSAT rating card | `token`, `id`, `dynamic_values` (e.g. `agent_name`), `rating`/`feedback_msg` if answered. Submission in [13-feedback.md](13-feedback.md). Also means the chat was closed. |
| `assign`, `new-channel`, `update`, `block`, `notification` | Nothing in the list | State updates; [09-realtime.md](09-realtime.md). |

## 3. Interactive payloads (WhatsApp / RCS style)

`content.interactive` (call it `ix`). Decide the kind with
`ix.type || ix.category`. Common parts:

- `ix.header`: `{ type: "text", text }`, `{ type: "image", image: { link } }`,
  `{ type: "video", video: { link } }` or `{ type: "document", document: { link } }`.
- `ix.body.text`, `ix.footer.text`.
- Buttons live in `ix.action.buttons[]` **or** `ix.actions.buttons[]`
  (accept both). A button is `{ type: "reply", reply: { id, title } }`,
  `{ type: "url", title, url, assets?: { image, video } }` or just `{ title }`.

**What to send on tap (all kinds):** a normal `text` message whose
`content.text` is the tapped **title**, with `replied_on` set to this
interactive message's id. That is how the bot matches the answer. URL
buttons only open the link; nothing is sent.

| Kind (`ix.type`) | Draw | Data |
| --- | --- | --- |
| `button`, `quick_reply` | header, body, footer, a column of buttons | `action.buttons[]` |
| `cta_url` | body and one or more link buttons | `actions.buttons[]` with `type: "url"` |
| `list` | body plus a "menu" button that opens sections of rows | `action.sections[]` or `actions.list.sections[]`: `{ title, rows: [{ id, title, description }] }`. Tap a row → send `row.title`. Button label: `actions.list.button_text` or `action.button`. |
| `carousel` | horizontally scrolling cards | `action.cards[]`, each `{ header, body: { text }, action: { name: "cta_url", parameters: { url, display_text } } \| { buttons: [...] } }`. Card button title may be under `quick_reply.title`, `reply.title` or `title`. |
| `product` | one product card and a CTA | `product_details[0].product_items[]` `{ retailer_id, name, price, description, image_url }`; featured item = `action.product_retailer_id` (else the first). CTA text = `product_details[0].text`; tap → send that text. |
| `product_list` | sections of product rows | `product_details[].product_items[]` is the catalog; `action.sections[]` (or `actions.sections[]`) is `{ title, product_items: [{ product_retailer_id }] }`. Tap a row → send `product.name`. CTA = `product_details[0].text`. |
| `location_request` | body and a "Share location" button | `actions.location_request` or `action.location_request`: `{ text_to_show \| text }`. There is no location message type: ask the browser for geolocation and send a Google Maps link as `text`. |

**Bot greeting** (chapter 12) is drawn with this same `button` renderer:
`{ type: "button", body: { text }, action: { buttons: [{ reply: { title } }] } }`.
Tapping sends the title without `replied_on` (it isn't a real message).

## 4. Apple Messages for Business payloads

These arrive on iMessage channels. The payload may be nested or flattened;
normalise first, then detect.

```js
const ixd  = ix.interactiveData || ix.interactive_data || ix.interactive?.interactiveData
          || (hasAny(ix, ["receivedMessage","replyMessage","requestIdentifier","bid","appId","bundleId","listPicker","quick-reply","quickReply","event","authenticate","oauth2","payment"]) ? ix : null);
const data = ixd?.data && !Array.isArray(ixd.data) ? ixd.data : ixd;     // feature dictionary
const received = ixd?.receivedMessage || {};                            // bubble title/subtitle/imageIdentifier
const reply    = ixd?.replyMessage || {};                               // what to show after answering
const images   = data?.images || ixd?.images || ix.images;              // [{ identifier, url | imageurl | data(base64) }]
```

Detect, in this order:

| Check | Kind |
| --- | --- |
| `ix.richLinkData` / `rich_link_data` / `richLink` / `rich_link` / `richLinkDataRef`, or `ix.type` is `richlink`/`rich_link` | **rich link** |
| `data["quick-reply"]` / `quickReply` / `quick_reply` | **quick reply** |
| `data.listPicker` / `list_picker` | **list picker** |
| `data.event.timeslots` / `timePicker` / `time_picker` | **time picker** |
| `data.authenticate` / `oauth2` | **authenticate** |
| `data.payment` | **Apple Pay** |
| `data.template === "messageForms"` or `data.pages` / `data.data.pages` | **form** |
| `ix.type` alias: `list_picker`, `time_picker`, `apple_pay`/`payment`, `authentication`/`auth`/`oauth2`, `form`/`messageforms`, `imessage_app`/`custom` | as named |
| `ixd.receivedMessage` or `ixd.appId` present | **custom iMessage app** |

Rendering convention (what iMessage does): show a **bubble** with
`received.title`, `received.subtitle` and the image resolved from
`received.imageIdentifier` against `images[]` (`url`, `imageurl` or base64
`data`). Tapping the bubble opens a **sheet**. After the user answers, swap
the bubble for `reply.title` / `reply.subtitle` (fall back to what they
chose).

**What to send on answer:** a `text` message with `replied_on` = this
message's id. The text per kind:

| Kind | Sheet contents | Text to send |
| --- | --- | --- |
| **Quick reply** | `qr.summaryText` plus up to 5 pills from `qr.items[].title` (no sheet, inline) | the tapped `title` |
| **List picker** | `data.listPicker[]` sections (sort by `order`): `{ title, multipleSelection, listPickerItem: [{ identifier, title, subtitle, imageIdentifier, order }] }`. Legacy shape: `actions.list.sections[].rows[]` with `id`, `title`, `description`. | single select: the item `title`; multi select: titles joined by `", "` |
| **Time picker** | `data.event`: `{ title, location: { title, latitude, longitude }, timezoneOffset (min), timeslots: [{ identifier, startTime (ISO), duration (s) }] }`. Group by day, show in the business timezone when `timezoneOffset` is given. | the chosen slot formatted as day + time range, e.g. `Tue, 3 Dec · 10:00–10:30` |
| **Form** | `data.pages[]` (or `data.data.pages[]`), each `{ pageIdentifier, type: "select" \| "picker" \| "datePicker" \| "input", title, subtitle, items[], options: { placeholder, labelText, startDate }, multipleSelection, nextPageIdentifier, submitForm }`. Walk pages; `select` items may set `nextPageIdentifier`. Optional `data.splash: { header, body, imageIdentifier }` as the first page. | one line per answer: `<page title>: <value>`, joined by newlines |
| **Authenticate** | `received.title` ("Sign in"), `received.subtitle`; `data.authenticate` / `oauth2` carries the OAuth request. Show a sign-in sheet. Sign-in itself completes on the user's Apple device; on the web just explain that. | nothing (or a text saying the user tapped sign in) |
| **Apple Pay** | `data.payment.paymentRequest`: `{ currencyCode, lineItems: [{ label, amount }], total: { label, amount } }`, `data.payment.merchantSession.displayName`. Show a payment summary sheet. Payment completes on the device. | nothing |
| **Rich link** | `{ url, title, assets: { image: { data \| url }, video } }`. `richLinkDataRef` means the real link is in `title`. Draw a link-preview card. | nothing (it's a link) |
| **Custom iMessage app** | `ixd.appName`, `appIconUrl`, `appId` (numeric → `https://apps.apple.com/app/id<appId>`), `received.*`, `ixd.attachments[].imageurl`. Draw a card; tap opens the App Store link. | nothing |

Channel list / quote preview text for Apple messages: `received.title`,
else the kind's own summary (`qr.summaryText`, `event.title`,
`splash.header`, rich link `title`, "Sign in request", "Apple Pay request").

## 5. Who sent it (alignment and name)

```
own     = message.chat_id && (!message.client_sender_id || message.client_sender_id === myUuid)
bot     = sender_id === "bot" || sender_id === "workflow" || is_auto_response === true
agent   = otherwise; name = from_name
```
