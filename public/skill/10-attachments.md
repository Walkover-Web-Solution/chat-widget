# 10. Custom UI: attachments

**Read this when:** users send images or files.
**Needs first:** [07-messages.md](07-messages.md); `inbox_id` from widget-info.
**Finished when:** a picked file appears as a card in the Hello inbox and in your UI.

## 1. Upload

One request per file, multipart.

```http
POST {base}/v2/upload/?type=chat&inbox_id={inbox_id}
authorization: WIDGET_TOKEN:uuid
content-type: multipart/form-data

attachment=<file>
```

```json
{ "data": [ "https://files.msg91.com/…/photo.jpg" ] }
```

Take `data[0]`. Upload in parallel, keep the order the user picked.

## 2. Send

```json
{ "type": "widget",
  "message_type": "attachment",              // or "text-attachment" when there is text too
  "content": { "text": "", "attachment": [ "https://files.msg91.com/…/photo.jpg" ] },
  "chat_id": 917068, "user_data": { ... }, "sessionVariables": {} }
```

Everything else is the normal send from chapter 7 (including the new-chat
`channelDetail` case).

## Render

Incoming `content.attachment[]` is the same list of URLs. Image extensions
(`png jpg jpeg gif webp svg`) → thumbnail that opens full size; anything
else → file name (last path segment) with a download link.

## Limits and errors

Size and type limits are set by the inbox on the Hello side. A 4xx from
upload carries `message`; show it and keep the file out of the send. Never
send a message with a failed upload's URL.
