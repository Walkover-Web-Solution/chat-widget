# 18. Type reference

**Read this when:** you want exact field names. Everything else in the book links here.

```ts
// ---- identity you pass in ----
interface UserIdentity {
  unique_id?: string;      // your user id; makes the session identified
  name?: string;
  mail?: string;
  number?: string;         // digits, no leading +
  user_jwt_token?: string; // server-signed, only with identity verification
}
// user_data = UserIdentity minus `name` minus empty values

// ---- routing-region ----
interface RoutingRegion { region_url: string; socket_url: string; country: string; company_id: number; inbox_id: number }

// ---- widget-info ----
interface WidgetInfo {
  company_id: number; inbox_id: number;
  bot_id?: string; bot_type?: "lex" | "chatgpt";
  teams: { id: number; name: string }[];
  event_channels: string[];          // one contains "typing"
  voice_call_widget: boolean;
  primary_color?: string; logo?: string; tagline?: string;
  show_widget_form?: boolean; feedback_text?: string;
  hide_launcher?: boolean; launch_widget?: boolean; is_domain_enable?: boolean;
}

// ---- pubnub-channels/list ----
interface ChannelList {
  uuid: string;
  channels: Channel[];
  customer_name: string; pseudo_name: boolean;   // name is real only if pseudo_name === false
  customer_mail: string | null; customer_number: string | null;
  call_enabled: boolean; presence_channel: string;
  country: string; country_iso2: string | null; city: string; region: string; ip: string;
}
interface Channel {
  id: number | null;                 // chat_id / ticket id; null = draft
  channel: string;                   // "ch-comp-<company>.<hex>"
  assigned_type: "bot" | "agent" | "team"; assigned_id: number;
  assigned_to: string | null; team_id: string | null;
  is_closed: boolean;
  unread_count: number; widget_unread_count: number; cc_unread_count: number;
  last_message: { message: Message; timetoken: number };
  total_message_count: number;
  is_peer_channel?: boolean; is_blocked?: boolean; peer_unread_count?: number;
  channel_peers?: { peer_name: string; peer_mail: string | null; peer_number: string | null; peer_uuid: string; peer_contact_id: string }[];
}

// ---- messages (history item and socket `response`) ----
interface HistoryItem { id: string; timetoken: number; message: Message }   // timetoken / 10000 = ms
interface Message {
  type: "chat" | "feedback" | "assign" | "new-channel" | "update" | "block" | "notification";
  message_type: "text" | "attachment" | "text-attachment" | "interactive" | "voice_call" | "video_call" | "pushNotification" | string;
  content: {
    text: string;
    attachment: string[] | null;     // URLs
    interactive?: Interactive;
    show_more?: boolean;
    // voice_call:
    status?: "completed" | "no_answer" | "in-progress"; start_time?: string; end_time?: string; duration?: number;
    body?: { text: string };         // interactive plain text
  };
  channel: string; chat_id: number | null; company_id: number;
  sender_id: "bot" | "workflow" | string; client_sender_id?: string | null;
  from_name?: string; is_auto_response?: boolean;
  message_id?: string; new_event?: boolean; state?: string;
  // replies
  replied_msg_content?: any; replied_msg_type?: string; replied_from_name?: string; replied_msg_sender_id?: string;
  // feedback
  token?: string; id?: number; rating?: Rating; feedback_msg?: string; dynamic_values?: Record<string, string>;
  // assign
  assignee_type?: "bot" | "agent" | "team"; assignee_id?: number; channel_details?: { channel: string };
  // new-channel
  ticket_id?: number; customer_name?: string; last_message?: Channel["last_message"]; widget_unread_count?: number; created_at?: string; current?: "closed" | string;
  // update
  client_id?: string;
  // block
  value?: boolean;
}
type Rating = "terrible" | "bad" | "ok" | "good" | "amazing";

interface Interactive {
  type?: "button" | "quick_reply" | "cta_url" | "list" | "carousel" | "product" | "product_list" | "location_request" | string;
  category?: string;
  header?: { type: "text"; text: string } | { type: "image"; image: { link: string } } | { type: "video"; video: { link: string } } | { type: "document"; document: { link: string } };
  body?: { text: string }; footer?: { text: string };
  action?: { buttons?: InteractiveButton[]; sections?: ListSection[]; cards?: CarouselCard[]; product_retailer_id?: string; list?: { sections: ListSection[] }; button?: string; location_request?: { text_to_show?: string; text?: string } };
  actions?: { buttons?: InteractiveButton[]; sections?: ListSection[]; list?: { sections: ListSection[]; button_text?: string }; location_request?: { text_to_show?: string; text?: string } };
  product_details?: ProductDetails[]; expiration_time?: string; text?: string;
}
type InteractiveButton = { type: "reply"; reply: { id: string; title: string } } | { type: "url"; title: string; url: string; assets?: { image?: string; video?: string } } | { title: string; quick_reply?: { title: string } };
interface ListSection { title?: string; rows?: { id: string; title: string; description?: string }[]; product_items?: { product_retailer_id: string }[] }
interface CarouselCard { header?: Interactive["header"]; body?: { text: string }; action?: { name?: "cta_url"; parameters?: { url: string; display_text?: string }; buttons?: InteractiveButton[] } }
interface ProductDetails { text?: string; product_items: { retailer_id: string; name: string; price?: string; description?: string; image_url?: string }[] }

// ---- Apple Messages for Business (inside content.interactive) ----
interface AppleInteractive {
  type?: string;                                   // "interactive" | "richLink" | alias (list_picker, time_picker, form, apple_pay, authentication, imessage_app)
  interactiveData?: AppleInteractiveData; interactive_data?: AppleInteractiveData;
  richLinkData?: AppleRichLink; rich_link_data?: AppleRichLink; richLink?: AppleRichLink; richLinkDataRef?: { title: string; url?: string };
  images?: AppleImage[];
  // or the fields of AppleInteractiveData flattened here
}
interface AppleInteractiveData {
  bid?: string; appId?: string | number; appName?: string; appIconUrl?: string; requestIdentifier?: string;
  receivedMessage?: AppleBubble; replyMessage?: AppleBubble;
  images?: AppleImage[]; attachments?: { imageurl?: string; url?: string }[];
  data?: AppleFeatureData;                          // or flattened:
  listPicker?: AppleListSection[]; "quick-reply"?: AppleQuickReply; event?: AppleEvent; authenticate?: any; oauth2?: any; payment?: ApplePayment; pages?: AppleFormPage[]; template?: "messageForms";
}
type AppleFeatureData = Pick<AppleInteractiveData, "listPicker" | "quick-reply" | "event" | "authenticate" | "oauth2" | "payment" | "pages" | "template" | "images"> & { splash?: { header?: string; body?: string; imageIdentifier?: string }; data?: { pages: AppleFormPage[]; splash?: any } };
interface AppleBubble { title?: string; subtitle?: string; secondarySubtitle?: string; tertiarySubtitle?: string; imageIdentifier?: string; imageTitle?: string; imageSubtitle?: string; style?: "icon" | "small" | "large" }
interface AppleImage { identifier: string | number; url?: string; imageurl?: string; data?: string; mimeType?: string }
interface AppleQuickReply { summaryText?: string; items: { identifier?: string; title: string }[] }
interface AppleListSection { title?: string; order?: number; multipleSelection?: boolean; listPickerItem?: AppleListItem[]; items?: AppleListItem[] }
interface AppleListItem { identifier?: string; title: string; subtitle?: string; imageIdentifier?: string; imageUrl?: string; order?: number }
interface AppleEvent { title?: string; location?: { title?: string; latitude?: number; longitude?: number }; timezoneOffset?: number; timeslots: { identifier?: string; startTime: string; duration?: number }[] }
interface ApplePayment { paymentRequest: { currencyCode: string; lineItems?: { label: string; amount: string | number }[]; total: { label: string; amount: string | number } }; merchantSession?: { displayName?: string } }
interface AppleFormPage { pageIdentifier: string; type: "select" | "picker" | "datePicker" | "input"; title?: string; subtitle?: string; multipleSelection?: boolean; items?: { identifier?: string; title: string; value?: string; nextPageIdentifier?: string }[]; options?: { placeholder?: string; labelText?: string; startDate?: string }; nextPageIdentifier?: string; submitForm?: boolean }
interface AppleRichLink { url: string; title?: string; assets?: { image?: { data?: string; url?: string; mimeType?: string }; video?: { url?: string } } }

// ---- send ----
interface SendRequest {
  type: "widget";
  message_type: "text" | "attachment" | "text-attachment" | "voice_call";
  content: { text: string; attachment: string[] | null };
  chat_id: number | null;
  channelDetail?: ChannelDetail;     // only when chat_id is null
  widget_msg_id?: string; replied_on?: string;
  user_data: Record<string, string>; sessionVariables: Record<string, any>;
}
interface ChannelDetail {
  new: true; channel_hex: string; uuid: string; unique_id?: string;
  team_id: number | null;
  customer_name: string | null; customer_mail: string | null; customer_number: string | null; pseudo_name: boolean | null;
  presence_channel?: string;
  call_enabled: null; country: null; country_iso2: null; is_blocked: null; chatInputSubmitted: false;
}
interface SendResponse { data: { id: number; channel: string; presence_channel?: string; uuid?: string; call_jwt_token?: string } }

// ---- socket ----
interface NewPublish { response: { id?: string; timetoken: number; company_id?: number; message: Message } }
interface TypingEvent { channel: string; type: "chat"; action: "typing" | "not-typing" }
```
