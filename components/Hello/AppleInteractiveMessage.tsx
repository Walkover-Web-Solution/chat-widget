import InterfaceMarkdown from '@/components/Interface-Chatbot/Interface-Markdown/InterfaceMarkdown';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, CreditCard, ExternalLink, FileText, List, Lock, MapPin } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useColor } from '../Chatbot/hooks/useColor';

/** Plain thumbnail for Apple bubbles: no download overlay, no lightbox, just a cover-fit image that hides itself on error. */
function AppleImage({ src, alt = '', className = '' }: { src: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover block select-none ${className}`}
    />
  );
}

/** Widget primary colour as CSS variables so Apple cards and sheets follow the configured theme. */
function useAppleAccentStyle(): React.CSSProperties {
  const { primaryBgColor, foregroundColor, primaryTintColor } = useColor();
  return {
    '--apple-accent': primaryBgColor,
    '--apple-accent-fg': foregroundColor,
    '--apple-accent-tint': primaryTintColor,
  } as React.CSSProperties;
}

type LinkPreview = { title?: string; image?: string; logo?: string } | null;
const linkPreviewCache = new Map<string, Promise<LinkPreview>>();
const LINK_PREVIEW_STORAGE_PREFIX = 'hello_link_preview:';

/**
 * Best-effort Open Graph unfurl for rich links whose image Apple only ships as an encrypted iCloud blob.
 * Uses microlink's public API (CORS-enabled, rate limited per client IP); failures resolve to null so the
 * card silently falls back to the favicon layout. Results are cached in memory and localStorage.
 */
function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const cached = linkPreviewCache.get(url);
  if (cached) return cached;
  const promise = (async (): Promise<LinkPreview> => {
    try {
      const stored = localStorage.getItem(LINK_PREVIEW_STORAGE_PREFIX + url);
      if (stored) return JSON.parse(stored);
    } catch { /* storage unavailable */ }
    try {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.status !== 'success') return null;
      const preview: LinkPreview = {
        title: json.data?.title || undefined,
        image: json.data?.image?.url || undefined,
        logo: json.data?.logo?.url || undefined,
      };
      try { localStorage.setItem(LINK_PREVIEW_STORAGE_PREFIX + url, JSON.stringify(preview)); } catch { /* ignore */ }
      return preview;
    } catch {
      return null;
    }
  })();
  linkPreviewCache.set(url, promise);
  return promise;
}

function useLinkPreview(url: string, enabled: boolean): LinkPreview {
  const [preview, setPreview] = useState<LinkPreview>(null);
  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;
    fetchLinkPreview(url).then((p) => { if (!cancelled) setPreview(p); });
    return () => { cancelled = true; };
  }, [url, enabled]);
  return enabled ? preview : null;
}

/**
 * Renders Apple Messages for Business interactive payloads.
 *
 * Apple payloads arrive as:
 *   { type: 'interactive', interactiveData: { data: {...}, receivedMessage: {...}, replyMessage: {...} } }
 *   { type: 'richLink', richLinkData: { url, title, assets } }
 * The backend may also flatten `interactiveData` onto the message, or tag the message with a
 * snake_case type (list_picker, time_picker, quick_reply, rich_link, apple_pay, authentication, form).
 * `detectAppleInteractiveType` accepts every one of those shapes.
 */

export const APPLE_INTERACTIVE_TYPES = {
  QUICK_REPLY: 'apple_quick_reply',
  LIST_PICKER: 'apple_list_picker',
  TIME_PICKER: 'apple_time_picker',
  RICH_LINK: 'apple_rich_link',
  FORM: 'apple_form',
  AUTHENTICATE: 'apple_authenticate',
  APPLE_PAY: 'apple_pay',
  CUSTOM: 'apple_custom',
} as const;

export type AppleInteractiveType = typeof APPLE_INTERACTIVE_TYPES[keyof typeof APPLE_INTERACTIVE_TYPES];

const TYPE_ALIASES: Record<string, AppleInteractiveType> = {
  list_picker: APPLE_INTERACTIVE_TYPES.LIST_PICKER,
  listpicker: APPLE_INTERACTIVE_TYPES.LIST_PICKER,
  // list: APPLE_INTERACTIVE_TYPES.LIST_PICKER,
  time_picker: APPLE_INTERACTIVE_TYPES.TIME_PICKER,
  timepicker: APPLE_INTERACTIVE_TYPES.TIME_PICKER,
  rich_link: APPLE_INTERACTIVE_TYPES.RICH_LINK,
  richlink: APPLE_INTERACTIVE_TYPES.RICH_LINK,
  apple_pay: APPLE_INTERACTIVE_TYPES.APPLE_PAY,
  applepay: APPLE_INTERACTIVE_TYPES.APPLE_PAY,
  payment: APPLE_INTERACTIVE_TYPES.APPLE_PAY,
  authentication: APPLE_INTERACTIVE_TYPES.AUTHENTICATE,
  authenticate: APPLE_INTERACTIVE_TYPES.AUTHENTICATE,
  imessage_app: APPLE_INTERACTIVE_TYPES.CUSTOM,
  imessageapp: APPLE_INTERACTIVE_TYPES.CUSTOM,
  custom: APPLE_INTERACTIVE_TYPES.CUSTOM,
  oauth2: APPLE_INTERACTIVE_TYPES.AUTHENTICATE,
  auth: APPLE_INTERACTIVE_TYPES.AUTHENTICATE,
  auth2: APPLE_INTERACTIVE_TYPES.AUTHENTICATE,
  form: APPLE_INTERACTIVE_TYPES.FORM,
  messageforms: APPLE_INTERACTIVE_TYPES.FORM,
};

const APPLE_MARKERS = ['receivedMessage', 'replyMessage', 'requestIdentifier', 'bid', 'appId', 'bundleId', 'listPicker', 'quick-reply', 'quickReply', 'event', 'authenticate', 'oauth2', 'payment'];

/** Returns the interactiveData block regardless of how deeply (or not at all) the backend nested it. */
export function getAppleInteractiveData(messageJson: any) {
  if (!messageJson || typeof messageJson !== 'object') return null;
  const nested = messageJson.interactiveData || messageJson.interactive_data || messageJson.interactive?.interactiveData;
  if (nested) return nested;
  // Hello flattens the payload: { type: 'timePicker', receivedMessage, event, ... }
  if (APPLE_MARKERS.some((key) => key in messageJson)) return messageJson;
  return null;
}

/** Feature dictionary: Apple nests it under `data`, Hello puts it at the top level. */
export function getAppleFeatureData(interactiveData: any) {
  if (!interactiveData) return null;
  return interactiveData.data && typeof interactiveData.data === 'object' && !Array.isArray(interactiveData.data)
    ? interactiveData.data
    : interactiveData;
}

const looksLikeUrl = (value: unknown) => typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Normalises rich link payloads to { url, title, assets }.
 * `richLinkDataRef` is Apple's large-payload pointer: `url` is an encrypted iCloud blob we cannot read,
 * and the link the user actually sent is carried in `title`. Only that link is surfaced.
 */
function getRichLinkData(messageJson: any) {
  const direct = messageJson?.richLinkData || messageJson?.rich_link_data || messageJson?.richLink || messageJson?.rich_link;
  if (direct) return direct;
  const ref = messageJson?.richLinkDataRef || messageJson?.rich_link_data_ref;
  if (ref) {
    const link = looksLikeUrl(ref.title) ? ref.title : looksLikeUrl(messageJson?.body) ? messageJson.body : '';
    return { url: link, title: ref.title || link, assets: undefined };
  }
  if (looksLikeUrl(messageJson?.body) && String(messageJson?.type || '').toLowerCase().replace('_', '') === 'richlink') {
    return { url: messageJson.body, title: messageJson.body, assets: undefined };
  }
  return null;
}

/**
 * True when the Apple payload renders its own iMessage-style card (list picker, time picker, rich link, …).
 * Such messages should not be wrapped in the generic chat bubble, or they look like a box inside a box.
 * Quick replies render bare pills and still want the bubble.
 */
export function isSelfContainedAppleMessage(messageJson: any): boolean {
  const type = detectAppleInteractiveType(messageJson);
  return Boolean(type) && type !== APPLE_INTERACTIVE_TYPES.QUICK_REPLY;
}

/** Detects the Apple interactive type of a payload, or null when the payload is not Apple-shaped. */
export function detectAppleInteractiveType(messageJson: any): AppleInteractiveType | null {
  if (!messageJson || typeof messageJson !== 'object') return null;

  if (getRichLinkData(messageJson)) return APPLE_INTERACTIVE_TYPES.RICH_LINK;

  const interactiveData = getAppleInteractiveData(messageJson);
  const data = getAppleFeatureData(interactiveData);

  if (data) {
    if (data['quick-reply'] || data.quickReply || data.quick_reply) return APPLE_INTERACTIVE_TYPES.QUICK_REPLY;
    if (data.listPicker || data.list_picker) return APPLE_INTERACTIVE_TYPES.LIST_PICKER;
    if (data.event?.timeslots || data.timePicker || data.time_picker) return APPLE_INTERACTIVE_TYPES.TIME_PICKER;
    if (data.authenticate || data.oauth2) return APPLE_INTERACTIVE_TYPES.AUTHENTICATE;
    if (data.payment) return APPLE_INTERACTIVE_TYPES.APPLE_PAY;
    if (data.template === 'messageForms' || data.data?.pages || data.pages) return APPLE_INTERACTIVE_TYPES.FORM;
  }

  const rawType = String(messageJson.type || messageJson.category || messageJson.message_type || '').toLowerCase();
  if (rawType === 'richlink' || rawType === 'rich_link') return APPLE_INTERACTIVE_TYPES.RICH_LINK;
  if (TYPE_ALIASES[rawType]) return TYPE_ALIASES[rawType];
  // `quick_reply` is shared with the WhatsApp shape, so only claim it when Apple structure is present.
  if ((rawType === 'quick_reply' || rawType === 'quick-reply') && interactiveData) return APPLE_INTERACTIVE_TYPES.QUICK_REPLY;

  if (interactiveData?.receivedMessage || interactiveData?.appId) return APPLE_INTERACTIVE_TYPES.CUSTOM;
  return null;
}

/** Best-effort one-line preview used by channel lists and reply quotes. */
export function getAppleInteractivePreviewText(messageJson: any): string | null {
  const type = detectAppleInteractiveType(messageJson);
  if (!type) return null;
  const interactiveData = getAppleInteractiveData(messageJson);
  const received = interactiveData?.receivedMessage;
  if (received?.title) return received.title;
  const data = getAppleFeatureData(interactiveData);
  switch (type) {
    case APPLE_INTERACTIVE_TYPES.RICH_LINK:
      return getRichLinkData(messageJson)?.title || getRichLinkData(messageJson)?.url || 'Link';
    case APPLE_INTERACTIVE_TYPES.QUICK_REPLY:
      return getQuickReply(data)?.summaryText || 'Quick reply';
    case APPLE_INTERACTIVE_TYPES.LIST_PICKER:
      return getLegacyListReceived(messageJson).title || 'List picker';
    case APPLE_INTERACTIVE_TYPES.TIME_PICKER:
      return data?.event?.title || 'Time picker';
    case APPLE_INTERACTIVE_TYPES.FORM:
      return (data?.data?.splash || data?.splash)?.header || 'Form';
    case APPLE_INTERACTIVE_TYPES.AUTHENTICATE:
      return 'Sign in request';
    case APPLE_INTERACTIVE_TYPES.CUSTOM:
      return interactiveData?.appName || 'Interactive Message';
    case APPLE_INTERACTIVE_TYPES.APPLE_PAY:
      return data?.payment?.paymentRequest?.total?.label || 'Apple Pay request';
    default:
      return 'Interactive Message';
  }
}

function getQuickReply(data: any) {
  return data?.['quick-reply'] || data?.quickReply || data?.quick_reply || null;
}

/**
 * Hello's list builder emits the WhatsApp-style shape for Apple too:
 *   { category: 'list', header, body, footer, actions: { list: { button_text, sections: [{ title, rows: [{ id, title, description }] }] } } }
 * Convert it into Apple list picker sections so ListPickerBubble can render it.
 */
function getLegacyListSections(messageJson: any): any[] {
  const list = messageJson?.actions?.list || messageJson?.action?.list || messageJson?.action;
  const sections = list?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.map((section: any, order: number) => ({
    title: section?.title,
    order,
    multipleSelection: section?.multipleSelection ?? section?.multiple_selection ?? true,
    listPickerItem: (section?.rows || section?.items || []).map((row: any, index: number) => ({
      identifier: row?.id ?? row?.identifier ?? `${order}-${index}`,
      title: row?.title,
      subtitle: row?.description ?? row?.subtitle,
      imageIdentifier: row?.imageIdentifier ?? row?.image?.identifier,
      imageUrl: row?.image?.url || row?.image?.link || row?.imageUrl,
      order: index,
    })),
  }));
}

/** Bubble title/subtitle for a legacy list payload, derived from header → body → footer. */
function getLegacyListReceived(messageJson: any) {
  const headerText = messageJson?.header?.type === 'text' ? messageJson?.header?.text : undefined;
  const bodyText = messageJson?.body?.text;
  const footerText = messageJson?.footer?.text;
  const buttonText = messageJson?.actions?.list?.button_text || messageJson?.action?.button;
  return {
    title: bodyText || headerText || buttonText,
    subtitle: footerText || 'Tap to open',
  };
}

/** First renderable image from a custom iMessage app's `attachments` list. */
function getAttachmentImage(attachments: any[] | undefined): string | null {
  if (!Array.isArray(attachments)) return null;
  for (const item of attachments) {
    const src = item?.imageurl || item?.imageUrl || item?.image_url || item?.url;
    if (typeof src === 'string' && src) return src;
  }
  return null;
}

/** Resolves an Apple `imageIdentifier` against the payload's `images` array to a renderable src. */
function resolveImage(images: any[] | undefined, identifier: string | number | undefined): string | null {
  if (identifier === undefined || identifier === null || !Array.isArray(images)) return null;
  const image = images.find((img) => String(img?.identifier) === String(identifier));
  if (!image) return null;
  // Apple uses `url`; Hello's builder emits `imageurl`.
  const url = image.url || image.imageurl || image.imageUrl || image.image_url;
  if (url) return url;
  if (image.data) {
    if (String(image.data).startsWith('data:') || String(image.data).startsWith('http')) return image.data;
    return `data:${image.mimeType || 'image/png'};base64,${image.data}`;
  }
  return null;
}

/**
 * Formats a timeslot. When Apple's `timezoneOffset` (minutes from UTC) is present the slot is shown in the
 * business's timezone, as iMessage does; otherwise it falls back to the viewer's local zone.
 */
function formatTimeslot(startTime: string, duration?: number, tzOffsetMinutes?: number | null) {
  // Apple sends e.g. "2025-07-10T17:00+0000" (no seconds, no Z). Normalise the offset so Date() parses it everywhere.
  const normalised = String(startTime || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalised);
  const start = new Date(dateOnly ? `${normalised}T00:00:00` : normalised);
  if (Number.isNaN(start.getTime())) return { day: startTime, range: '', start: undefined as Date | undefined, tzLabel: '' };
  if (dateOnly) {
    return { day: start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), range: '', start, tzLabel: '' };
  }
  const useTz = typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes);
  // Shift into the target zone and format as UTC so the wall-clock time matches that zone.
  const shift = (d: Date) => (useTz ? new Date(d.getTime() + tzOffsetMinutes! * 60000) : d);
  const fmtOpts = useTz ? { timeZone: 'UTC' } : {};
  const end = duration ? new Date(start.getTime() + duration * 1000) : null;
  const day = shift(start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...fmtOpts });
  const startLabel = shift(start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...fmtOpts });
  const endLabel = end ? shift(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...fmtOpts }) : '';
  const tzLabel = useTz ? formatTzOffset(tzOffsetMinutes!) : '';
  return { day, range: endLabel ? `${startLabel} – ${endLabel}` : startLabel, startLabel, start: shift(start), tzLabel };
}

function formatTzOffset(minutes: number) {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `GMT${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

function mapsUrl(location: any) {
  if (!location) return null;
  const { latitude, longitude, title } = location;
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }
  return title ? `https://www.google.com/maps?q=${encodeURIComponent(title)}` : null;
}

/* ------------------------------------------------------------------ */
/* iMessage-style UI                                                   */
/* ------------------------------------------------------------------ */

type Props = {
  messageJson: any;
  sendMessageToHello?: (text: string) => void;
  readOnly?: boolean;
};

/** Full-screen sheet, matching the iMessage extension presentation. Rendered in a portal so it escapes the bubble. */
function AppleSheet({
  title,
  onClose,
  onConfirm,
  confirmLabel = 'Done',
  confirmDisabled = false,
  children,
}: {
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}) {
  const accentStyle = useAppleAccentStyle();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      style={accentStyle}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:w-[380px] max-h-[85vh] flex flex-col bg-[#f2f2f7] dark:bg-[#1c1c1e] text-black dark:text-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <button type="button" className="text-[#007aff]" onClick={onClose}>Cancel</button>
          <div className="font-semibold truncate px-2">{title}</div>
          {onConfirm ? (
            <button
              type="button"
              className="text-[#007aff] font-semibold disabled:opacity-40"
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          ) : <span className="w-12" />}
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** iMessage-style link preview card: hero image (when known) over a bold title and the host. */
function RichLinkCard({ richLink }: { richLink: any }) {
  const url: string = richLink.url || '';
  const imageAsset = richLink.assets?.image;
  const videoAsset = richLink.assets?.video;
  const hasAssets = Boolean(imageAsset?.url || imageAsset?.data || videoAsset?.url);
  // Only unfurl when Apple gave us nothing but the link (richLinkDataRef case).
  const preview = useLinkPreview(url, Boolean(url) && !hasAssets);
  const title: string = (!richLink.title || looksLikeUrl(richLink.title) ? preview?.title : null) || richLink.title || url || 'Link';
  const imageSrc = imageAsset?.url
    || (imageAsset?.data
      ? (String(imageAsset.data).startsWith('data:') || String(imageAsset.data).startsWith('http')
        ? imageAsset.data
        : `data:${imageAsset.mimeType || 'image/png'};base64,${imageAsset.data}`)
      : null)
    || preview?.image
    || null;
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { host = url; }
  const titleIsUrl = looksLikeUrl(title);
  // richLinkDataRef only gives us the link (its image is an encrypted iCloud blob), so fall back to the site's favicon.
  const faviconSrc = !imageSrc && !videoAsset?.url && host
    ? preview?.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block w-[280px] max-w-full rounded-2xl overflow-hidden bg-[#e9e9eb] dark:bg-[#26252a] text-black dark:text-white shadow-sm no-underline hover:brightness-95 transition"
    >
      {videoAsset?.url ? (
        <video src={videoAsset.url} poster={imageSrc || undefined} className="w-full max-h-[160px] object-cover bg-black" controls preload="metadata" playsInline />
      ) : imageSrc ? (
        <div className="w-full h-[150px] overflow-hidden">
          <AppleImage src={imageSrc} alt={title} />
        </div>
      ) : null}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {faviconSrc && (
          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-white dark:bg-white/10 flex items-center justify-center p-1.5">
            <AppleImage src={faviconSrc} alt={host} className="!object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`font-semibold text-md leading-tight line-clamp-2 ${titleIsUrl ? 'break-all' : 'break-words'}`}>{titleIsUrl ? host || title : title}</div>
          <div className="text-sm opacity-60 mt-0.5 truncate">{titleIsUrl ? url.replace(/^https?:\/\//, '') : host}</div>
        </div>
      </div>
    </a>
  );
}

/** The compact bubble iMessage shows for an interactive message: image + title/subtitle + chevron. */
function AppleBubble({
  imageSrc,
  style,
  title,
  subtitle,
  icon,
  onClick,
  disabled,
}: {
  imageSrc?: string | null;
  style?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isLarge = style === 'large';
  const isIcon = style === 'icon';
  const interactive = Boolean(onClick) && !disabled;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`text-left w-[280px] max-w-full rounded-2xl overflow-hidden bg-[#e9e9eb] dark:bg-[#26252a] text-black dark:text-white shadow-sm ${interactive ? 'active:opacity-80 hover:brightness-95 dark:hover:brightness-110' : 'cursor-default'} transition`}
    >
      {isLarge && imageSrc && (
        <div className="w-full h-[150px] overflow-hidden bg-black/5">
          <AppleImage src={imageSrc} alt={title || ''} />
        </div>
      )}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {!isLarge && (imageSrc ? (
          <div className={`${isIcon ? 'w-10 h-10' : 'w-[60px] h-[60px]'} flex-shrink-0 rounded-lg overflow-hidden bg-black/5`}>
            <AppleImage src={imageSrc} alt={title || ''} />
          </div>
        ) : icon ? (
          <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center">{icon}</div>
        ) : null)}
        <div className="min-w-0 flex-1">
          {title && <div className="font-semibold leading-tight break-words">{title}</div>}
          {subtitle && <div className="text-sm opacity-60 leading-tight break-words mt-0.5">{subtitle}</div>}
        </div>
        {interactive && <ChevronRight size={18} className="opacity-40 flex-shrink-0" />}
      </div>
    </button>
  );
}

const Check = ({ visible }: { visible: boolean }) => (
  <span
    className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[var(--apple-accent-fg)] text-sm transition ${visible ? 'bg-[var(--apple-accent)]' : 'border-2 border-black/25 dark:border-white/40'}`}
  >
    {visible && '✓'}
  </span>
);

const rowClass = 'w-full flex items-center gap-3 px-4 min-h-[48px] text-left bg-white dark:bg-[#2c2c2e] border-b border-black/5 dark:border-white/5 last:border-b-0 active:bg-black/5';

function AppleInteractiveMessage(props: Props) {
  const accentStyle = useAppleAccentStyle();
  // `display: contents` keeps layout untouched while the CSS variables inherit to every card below.
  return (
    <div style={accentStyle} className="contents">
      <AppleInteractiveMessageBody {...props} />
    </div>
  );
}

function AppleInteractiveMessageBody({ messageJson, sendMessageToHello, readOnly = false }: Props) {
  const type = detectAppleInteractiveType(messageJson);
  const interactiveData = getAppleInteractiveData(messageJson);
  const data = getAppleFeatureData(interactiveData) || {};
  const images: any[] | undefined = data.images || interactiveData?.images || messageJson?.images;
  const received = interactiveData?.receivedMessage || {};
  const reply = interactiveData?.replyMessage || {};

  const [open, setOpen] = useState(false);
  const [replied, setReplied] = useState<{ title: string; subtitle?: string } | null>(null);
  const close = useCallback(() => setOpen(false), []);

  const submit = (text: string, replyTitle?: string, replySubtitle?: string) => {
    setOpen(false);
    if (readOnly || !text) return;
    sendMessageToHello?.(text);
    setReplied({ title: reply.title || replyTitle || text, subtitle: reply.subtitle ?? replySubtitle });
  };

  // Custom iMessage apps ship their hero image as `attachments[].imageurl` instead of an imageIdentifier.
  const attachmentImage = getAttachmentImage(interactiveData?.attachments || messageJson?.attachments);
  const receivedImage = resolveImage(images, received.imageIdentifier) || attachmentImage;
  const replyImage = resolveImage(images, reply.imageIdentifier) || receivedImage;

  // After the user answers, iMessage swaps the bubble for the replyMessage card.
  if (replied) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <AppleBubble imageSrc={replyImage} style={reply.style || received.style} title={replied.title} subtitle={replied.subtitle} />
      </div>
    );
  }

  switch (type) {
    /* ---------------- Quick reply: inline pills under the summary ---------------- */
    case APPLE_INTERACTIVE_TYPES.QUICK_REPLY: {
      const quickReply = getQuickReply(data);
      if (!quickReply?.summaryText && !(quickReply?.items || []).some((item: any) => item?.title)) return null;
      return (
        <div className="flex flex-col gap-2">
          {quickReply?.summaryText && <InterfaceMarkdown className="mb-1">{quickReply.summaryText}</InterfaceMarkdown>}
          <div className="flex flex-wrap gap-2">
            {(quickReply?.items || []).filter((item: any) => item?.title).slice(0, 5).map((item: any, index: number) => (
              <button
                key={item?.identifier || index}
                type="button"
                disabled={readOnly}
                className="rounded-full border border-[var(--apple-accent)] text-[var(--apple-accent)] px-4 py-1.5 text-sm font-medium bg-white dark:bg-transparent hover:bg-[var(--apple-accent-tint)] active:bg-[var(--apple-accent)] active:text-[var(--apple-accent-fg)] transition disabled:opacity-60"
                onClick={(e) => { e.stopPropagation(); submit(item?.title); }}
              >
                {item?.title}
              </button>
            ))}
          </div>
        </div>
      );
    }

    /* ---------------- List picker: bubble → sheet with sections, checkmarks, Done ---------------- */
    case APPLE_INTERACTIVE_TYPES.LIST_PICKER: {
      const nativeSections = data.listPicker || data.list_picker;
      const sections: any[] = [...(nativeSections || getLegacyListSections(messageJson))].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
      const listReceived = Object.keys(received).length ? received : getLegacyListReceived(messageJson);
      return (
        <ListPickerBubble
          sections={sections}
          images={images}
          received={listReceived}
          receivedImage={receivedImage}
          open={open}
          setOpen={setOpen}
          close={close}
          readOnly={readOnly}
          onSubmit={submit}
        />
      );
    }

    /* ---------------- Time picker: bubble → sheet with day strip and slot list, Confirm ---------------- */
    case APPLE_INTERACTIVE_TYPES.TIME_PICKER: {
      const event = data.event || data.timePicker || data.time_picker || {};
      return (
        <TimePickerBubble
          event={event}
          images={images}
          received={received}
          receivedImage={receivedImage}
          open={open}
          setOpen={setOpen}
          close={close}
          readOnly={readOnly}
          onSubmit={submit}
        />
      );
    }

    /* ---------------- Rich link: iMessage link preview card ---------------- */
    case APPLE_INTERACTIVE_TYPES.RICH_LINK:
      return <RichLinkCard richLink={getRichLinkData(messageJson) || {}} />;

    /* ---------------- Form: bubble → multi-page sheet ---------------- */
    case APPLE_INTERACTIVE_TYPES.FORM: {
      const form = data.data?.pages ? data.data : data;
      return (
        <FormBubble
          form={form}
          images={images}
          received={received}
          receivedImage={receivedImage}
          open={open}
          setOpen={setOpen}
          close={close}
          readOnly={readOnly}
          onSubmit={submit}
        />
      );
    }

    /* ---------------- Authentication: bubble → sign-in sheet ---------------- */
    case APPLE_INTERACTIVE_TYPES.AUTHENTICATE: {
      return (
        <>
          <AppleBubble
            imageSrc={receivedImage}
            style={received.style}
            title={received.title || 'Sign in'}
            subtitle={received.subtitle}
            icon={<Lock size={18} />}
            onClick={() => setOpen(true)}
            disabled={readOnly}
          />
          {open && (
            <AppleSheet title={received.title || 'Sign in'} onClose={close}>
              <div className="flex flex-col items-center text-center gap-4 p-6">
                <div className="w-16 h-16 rounded-2xl bg-[var(--apple-accent-tint)] flex items-center justify-center text-[var(--apple-accent)]"><Lock size={28} /></div>
                <div>
                  <div className="font-semibold text-lg">{received.title || 'Sign in required'}</div>
                  {received.subtitle && <div className="text-sm opacity-60 mt-1">{received.subtitle}</div>}
                </div>
                <div className="text-sm opacity-60">Sign-in for this request can only be completed inside Apple Messages.</div>
              </div>
            </AppleSheet>
          )}
        </>
      );
    }

    /* ---------------- Apple Pay: bubble → payment sheet ---------------- */
    case APPLE_INTERACTIVE_TYPES.APPLE_PAY: {
      const payment = data.payment || (data.paymentRequest ? data : {});
      const request = payment.paymentRequest || {};
      const total = request.total || {};
      const lineItems: any[] = request.lineItems || [];
      const currency = request.currencyCode;
      const formatAmount = (amount: any) => {
        const value = Number(amount);
        if (Number.isNaN(value) || !currency) return String(amount ?? '');
        try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); } catch { return `${amount} ${currency}`; }
      };
      const merchant = payment.merchantSession?.displayName;
      return (
        <>
          <AppleBubble
            imageSrc={receivedImage}
            style={received.style}
            title={received.title || merchant || 'Apple Pay'}
            subtitle={received.subtitle || (total.amount !== undefined ? formatAmount(total.amount) : undefined)}
            icon={<CreditCard size={18} />}
            onClick={() => setOpen(true)}
            disabled={readOnly}
          />
          {open && (
            <AppleSheet title="Apple Pay" onClose={close}>
              <div className="p-4 flex flex-col gap-3">
                <div className="rounded-xl bg-white dark:bg-[#2c2c2e] overflow-hidden">
                  {merchant && <div className={rowClass}><span className="opacity-60 text-sm w-20">Pay</span><span className="font-medium">{merchant}</span></div>}
                  {lineItems.map((item, i) => (
                    <div key={i} className={rowClass}><span className="flex-1 truncate">{item?.label}</span><span>{formatAmount(item?.amount)}</span></div>
                  ))}
                  {total.amount !== undefined && (
                    <div className={rowClass}><span className="flex-1 font-semibold">{total.label || 'Total'}</span><span className="font-semibold">{formatAmount(total.amount)}</span></div>
                  )}
                </div>
                <div className="text-sm opacity-60 text-center">Payment can only be completed with Apple Pay inside Apple Messages.</div>
              </div>
            </AppleSheet>
          )}
        </>
      );
    }

    /* ---------------- Custom iMessage app ---------------- */
    case APPLE_INTERACTIVE_TYPES.CUSTOM: {
      // Apple's `URL` field only carries query params for the app, so link to the App Store listing instead.
      const appId = String(interactiveData?.appId || interactiveData?.app_id || '').trim();
      const openUrl: string | undefined = /^\d+$/.test(appId) ? `https://apps.apple.com/app/id${appId}` : undefined;
      const appName = interactiveData?.appName || interactiveData?.app_name;
      const appIcon = interactiveData?.appIconUrl || interactiveData?.app_icon_url;
      const details = [received.secondarySubtitle, received.tertiarySubtitle].filter(Boolean);
      const interactive = Boolean(openUrl);
      // Every field is optional; only fall back to a generic label when the card would otherwise be blank.
      const hasVisualContent = Boolean(receivedImage || appIcon || appName);
      const title = received.title || (!hasVisualContent && !received.subtitle && !details.length ? 'Interactive Message' : '');
      const hasTextRow = Boolean(title || received.subtitle || details.length || interactive);
      return (
        <div
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={interactive ? (e) => { e.stopPropagation(); window.open(openUrl, '_blank', 'noopener,noreferrer'); } : undefined}
          onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.open(openUrl, '_blank', 'noopener,noreferrer'); } } : undefined}
          className={`w-[280px] max-w-full rounded-2xl overflow-hidden bg-[#e9e9eb] dark:bg-[#26252a] text-black dark:text-white shadow-sm ${interactive ? 'cursor-pointer active:opacity-80 hover:brightness-95 dark:hover:brightness-110' : ''} transition`}
        >
          {(appIcon || appName) && (
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
              {appIcon ? (
                <div className="w-6 h-6 flex-shrink-0 rounded-md overflow-hidden bg-black/5">
                  <AppleImage src={appIcon} alt={appName || ''} />
                </div>
              ) : (
                <div className="w-6 h-6 flex-shrink-0 rounded-md bg-black/10 dark:bg-white/10 flex items-center justify-center"><ExternalLink size={14} /></div>
              )}
              {appName && <div className="text-sm font-medium opacity-70 truncate">{appName}</div>}
            </div>
          )}
          {receivedImage && (
            <div className="relative w-full h-[150px] overflow-hidden bg-black/5">
              <AppleImage src={receivedImage} alt={received.imageTitle || title || appName || ''} />
              {(received.imageTitle || received.imageSubtitle) && (
                <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent text-white">
                  {received.imageTitle && <div className="font-semibold text-sm leading-tight break-words drop-shadow">{received.imageTitle}</div>}
                  {received.imageSubtitle && <div className="text-xs opacity-90 leading-tight break-words drop-shadow">{received.imageSubtitle}</div>}
                </div>
              )}
            </div>
          )}
          {hasTextRow && (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                {title && <div className="font-semibold leading-tight break-words">{title}</div>}
                {received.subtitle && <div className="text-sm opacity-60 leading-tight break-words mt-0.5">{received.subtitle}</div>}
                {details.length > 0 && (
                  <div className="text-xs opacity-50 leading-tight break-words mt-1">{details.join(' · ')}</div>
                )}
              </div>
              {interactive && <ChevronRight size={18} className="opacity-40 flex-shrink-0" />}
            </div>
          )}
          {!interactive && (
            <div className="px-3 pb-2.5 text-xs opacity-50">Open in Apple Messages to use this app</div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

/* ---------------- List picker sheet ---------------- */
function ListPickerBubble({ sections, images, received, receivedImage, open, setOpen, close, readOnly, onSubmit }: any) {
  const multiple = sections.some((s: any) => s?.multipleSelection);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const selectedItems = Object.values(selected);

  const itemKey = (item: any) => String(item?.identifier ?? item?.title);

  // Apple allows one selection per section; tapping another row in the same section replaces it.
  const toggle = (item: any, sectionIndex: number) => {
    if (!multiple) {
      onSubmit(item?.title, item?.title, item?.subtitle);
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      if (next[sectionIndex] && itemKey(next[sectionIndex]) === itemKey(item)) delete next[sectionIndex];
      else next[sectionIndex] = item;
      return next;
    });
  };

  const confirm = () => {
    if (!selectedItems.length) return;
    const titles = selectedItems.map((i: any) => i?.title).filter(Boolean);
    onSubmit(titles.join(', '), titles.join(', '));
  };

  const count = sections.reduce((n: number, s: any) => n + (s?.listPickerItem || s?.items || []).length, 0);
  return (
    <>
      <AppleBubble
        imageSrc={receivedImage}
        style={received.style}
        title={received.title || sections[0]?.title || 'Choose an option'}
        subtitle={received.subtitle || `${count} option${count === 1 ? '' : 's'}`}
        icon={<List size={18} />}
        onClick={() => setOpen(true)}
        disabled={readOnly}
      />
      {open && (
        <AppleSheet
          title={received.title || 'Select'}
          onClose={close}
          onConfirm={multiple ? confirm : undefined}
          confirmLabel="Send"
          confirmDisabled={!selectedItems.length}
        >
          {sections.map((section: any, sIdx: number) => {
            const items: any[] = [...(section?.listPickerItem || section?.items || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
            return (
              <div key={sIdx} className="mt-4">
                {section?.title && <div className="px-4 pb-1 text-xs uppercase tracking-wide opacity-50">{section.title}</div>}
                <div className="mx-4 rounded-xl overflow-hidden">
                  {items.map((item, iIdx) => {
                    const key = itemKey(item);
                    const isSelected = Boolean(selected[sIdx]) && itemKey(selected[sIdx]) === key;
                    const img = item?.imageUrl || resolveImage(images, item?.imageIdentifier);
                    return (
                      <button key={key || iIdx} type="button" className={rowClass} onClick={() => toggle(item, sIdx)}>
                        {img && <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"><AppleImage src={img} alt={item?.title} /></div>}
                        <div className="flex-1 min-w-0 py-2">
                          <div className="break-words">{item?.title}</div>
                          {item?.subtitle && <div className="text-sm opacity-60 break-words">{item.subtitle}</div>}
                        </div>
                        {multiple ? <Check visible={isSelected} /> : <ChevronRight size={16} className="opacity-30" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="h-4" />
        </AppleSheet>
      )}
    </>
  );
}

/* ---------------- Time picker sheet ---------------- */
function TimePickerBubble({ event, images, received, receivedImage, open, setOpen, close, readOnly, onSubmit }: any) {
  const slots: any[] = event?.timeslots || [];
  const eventImage = resolveImage(images, event?.imageIdentifier);
  const tzOffset: number | null = typeof event?.timezoneOffset === 'number' ? event.timezoneOffset : null;
  const location = event?.location;
  const locationUrl = mapsUrl(location);

  const parsed = useMemo(() => slots.map((slot) => {
    const { day, range, start, tzLabel } = formatTimeslot(slot?.startTime, slot?.duration, tzOffset);
    return { ...slot, day, range, start, tzLabel, durationLabel: formatDuration(slot?.duration) };
  }), [slots, tzOffset]);
  const tzLabel = parsed.find((s) => s.tzLabel)?.tzLabel || '';

  const days = useMemo(() => {
    const seen = new Map<string, any>();
    parsed.forEach((s) => { if (!seen.has(s.day)) seen.set(s.day, s.start); });
    return Array.from(seen.entries()).map(([day, start]) => ({ day, start }));
  }, [parsed]);

  const [picked, setPicked] = useState<any>(null);
  const slotKey = (slot: any, index: number) => String(slot?.identifier ?? `${slot?.startTime}-${index}`);
  const groups = useMemo(() => days.map(({ day }) => ({ day, slots: parsed.filter((s) => s.day === day) })), [days, parsed]);

  const label = (s: any) => (s.range ? `${s.day}, ${s.range}` : s.day);

  return (
    <>
      <AppleBubble
        imageSrc={receivedImage || eventImage}
        style={received.style}
        title={received.title || event?.title || 'Pick a time'}
        subtitle={received.subtitle || (event?.location?.title ?? `${slots.length} time slot${slots.length === 1 ? '' : 's'}`)}
        icon={<Calendar size={18} />}
        onClick={() => setOpen(true)}
        disabled={readOnly}
      />
      {open && (
        <AppleSheet
          title={received.title || event?.title || 'Pick a time'}
          onClose={close}
          onConfirm={() => picked && onSubmit(label(picked), event?.title || label(picked), label(picked))}
          confirmLabel="Send"
          confirmDisabled={!picked}
        >
          {(received.title || received.subtitle) && (
            <div className="px-4 pt-5 pb-3">
              {received.title && <div className="font-bold leading-tight break-words">{received.title}</div>}
              {received.subtitle && <div className="opacity-60 mt-1 break-words">{received.subtitle}</div>}
            </div>
          )}
          {(eventImage || event?.title || location?.title) && (
            <div className="flex items-center gap-3 px-4 pt-4">
              {eventImage && <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-black/5"><AppleImage src={eventImage} alt={event?.title} /></div>}
              <div className="min-w-0">
                {event?.title && <div className="font-semibold">{event.title}</div>}
                {location?.title && (
                  locationUrl ? (
                    <a
                      href={locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(locationUrl, '_blank', 'noopener,noreferrer'); }}
                      className="text-sm text-[var(--apple-accent)] flex items-center gap-1 hover:underline"
                    >
                      <MapPin size={12} />{location.title}
                    </a>
                  ) : (
                    <div className="text-sm opacity-60 flex items-center gap-1"><MapPin size={12} />{location.title}</div>
                  )
                )}
                {tzLabel && <div className="text-xs opacity-50">Times shown in {tzLabel}</div>}
              </div>
            </div>
          )}
          <div className="px-4 pt-4 pb-14 flex flex-col gap-6">
            {groups.map(({ day, slots: daySlots }) => (
              <div key={day}>
                <div className="font-semibold mb-3">{day}</div>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot, i) => {
                    const key = slotKey(slot, i);
                    const isPicked = Boolean(picked) && slotKey(picked, picked.__index ?? -1) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPicked(isPicked ? null : { ...slot, __index: i })}
                        title={slot.durationLabel ? `${slot.range} · ${slot.durationLabel}` : slot.range}
                        className={`min-w-[6.5rem] px-5 py-2.5 rounded-xl border-2 border-[var(--apple-accent)] text-center font-medium transition ${isPicked ? 'bg-[var(--apple-accent)] text-[var(--apple-accent-fg)]' : 'bg-transparent text-[var(--apple-accent)] hover:bg-[var(--apple-accent-tint)]'}`}
                      >
                        {slot.startLabel || slot.range || 'All day'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groups.length && <div className="py-3 text-sm opacity-60 text-center">No times available</div>}
          </div>
        </AppleSheet>
      )}
    </>
  );
}

/* ---------------- Form sheet (select / picker / datePicker / input pages) ---------------- */
function FormBubble({ form, images, received, receivedImage, open, setOpen, close, readOnly, onSubmit }: any) {
  const pages: any[] = form?.pages || [];
  const splash = form?.splash;
  const splashImage = resolveImage(images, splash?.imageIdentifier);
  const pageById = useMemo(() => Object.fromEntries(pages.map((p) => [p.pageIdentifier, p])), [pages]);

  const [showSplash, setShowSplash] = useState(Boolean(splash));
  const [history, setHistory] = useState<string[]>([form?.startPageIdentifier || pages[0]?.pageIdentifier]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [draft, setDraft] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  const pageId = history[history.length - 1];
  const page = pageById[pageId];
  const isLast = (p: any) => Boolean(p?.submitForm) || !(p?.nextPageIdentifier || (p?.type === 'select' && !p?.multipleSelection && (p?.items || []).some((i: any) => i.nextPageIdentifier)));

  const reset = () => { setHistory([form?.startPageIdentifier || pages[0]?.pageIdentifier]); setAnswers({}); setDraft(null); setShowSummary(false); setShowSplash(Boolean(splash)); };
  const onClose = () => { close(); reset(); };

  // Pickers and date pickers show a default selection, so treat it as the value until the user changes it.
  const defaultValue = (() => {
    if (!page) return undefined;
    if (page.type === 'picker') {
      const item = page.items?.[page.selectedItemIndex ?? 0];
      return item ? item.value ?? item.identifier : undefined;
    }
    if (page.type === 'datePicker') return page.options?.startDate ? toInputDate(page.options.startDate) : undefined;
    return undefined;
  })();
  const currentValue = draft ?? answers[pageId] ?? defaultValue;
  const valid = (() => {
    if (!page) return false;
    if (page.type === 'select') return Array.isArray(currentValue) ? currentValue.length > 0 : Boolean(currentValue);
    if (page.type === 'picker') return currentValue !== undefined && currentValue !== null;
    if (page.type === 'datePicker') return Boolean(currentValue);
    if (page.type === 'input') {
      const text = String(currentValue ?? '');
      if (page.options?.required && !text.trim()) return false;
      if (page.options?.regex) { try { return new RegExp(JSON.parse(page.options.regex)).test(text); } catch { return true; } }
      return true;
    }
    return true;
  })();

  const displayValue = (p: any, v: any) => {
    if (p?.type === 'select') {
      const arr = Array.isArray(v) ? v : [v];
      return arr.map((val) => (p.items || []).find((i: any) => i.value === val || i.identifier === val)?.title || val).join(', ');
    }
    if (p?.type === 'picker') return (p.items || []).find((i: any) => i.value === v || i.identifier === v)?.title || v;
    return v;
  };

  const next = () => {
    if (!page || !valid) return;
    const value = currentValue;
    const nextAnswers = { ...answers, [pageId]: value };
    setAnswers(nextAnswers);
    setDraft(null);
    let nextId = page.nextPageIdentifier;
    if (page.type === 'select' && !page.multipleSelection) {
      const item = (page.items || []).find((i: any) => i.value === value || i.identifier === value);
      nextId = item?.nextPageIdentifier || nextId;
    }
    if (page.submitForm || !nextId || !pageById[nextId]) {
      if (form?.showSummary !== false) { setShowSummary(true); return; }
      finish(nextAnswers);
      return;
    }
    setHistory((h) => [...h, nextId]);
  };

  const finish = (finalAnswers = answers) => {
    const lines = Object.entries(finalAnswers).map(([id, v]) => `${pageById[id]?.title || pageById[id]?.subtitle || id}: ${displayValue(pageById[id], v)}`);
    onSubmit(lines.join('\n'), 'Form submitted', `${lines.length} answer${lines.length === 1 ? '' : 's'}`);
    reset();
  };

  const back = () => {
    if (showSummary) { setShowSummary(false); return; }
    if (history.length > 1) { setDraft(null); setHistory((h) => h.slice(0, -1)); } else if (splash) { setShowSplash(true); }
  };

  const renderPage = () => {
    if (!page) return <div className="p-6 text-center opacity-60">This form has no pages.</div>;
    const header = (
      <div className="px-4 pt-5 pb-3">
        {page.title && <div className="font-bold text leading-tight">{page.title}</div>}
        {page.subtitle && <div className="text-sm opacity-60 mt-1">{page.subtitle}</div>}
      </div>
    );
    switch (page.type) {
      case 'select': {
        const multi = Boolean(page.multipleSelection);
        const chosen: any[] = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
        return (
          <>
            {header}
            <div className="mx-4 rounded-xl overflow-hidden">
              {(page.items || []).map((item: any, i: number) => {
                const val = item.value ?? item.identifier;
                const on = chosen.includes(val);
                const img = resolveImage(images, item.imageIdentifier);
                return (
                  <button
                    key={item.identifier || i}
                    type="button"
                    className={rowClass}
                    onClick={() => setDraft(multi ? (on ? chosen.filter((c) => c !== val) : [...chosen, val]) : val)}
                  >
                    {img && <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"><AppleImage src={img} alt={item.title} /></div>}
                    <div className="flex-1 py-2">{item.title}</div>
                    <Check visible={on} />
                  </button>
                );
              })}
            </div>
          </>
        );
      }
      case 'picker':
        return (
          <>
            {header}
            <div className="px-4">
              {page.pickerTitle && <div className="text-sm opacity-50 mb-1">{page.pickerTitle}</div>}
              <div className="relative">
                <select
                  className="w-full rounded-xl bg-white dark:bg-[#2c2c2e] pl-4 pr-10 py-3 outline-none appearance-none"
                  value={currentValue ?? ''}
                  onChange={(e) => setDraft(e.target.value)}
                >
                  {(page.items || []).map((item: any, i: number) => <option key={item.identifier || i} value={item.value ?? item.identifier}>{item.title}</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-50" />
              </div>
            </div>
          </>
        );
      case 'datePicker':
        return (
          <>
            {header}
            <div className="px-4">
              {page.options?.labelText && <div className="text-sm opacity-50 mb-1">{page.options.labelText}</div>}
              <input
                type="date"
                className="w-full rounded-xl bg-white dark:bg-[#2c2c2e] px-4 py-3 outline-none"
                value={currentValue ?? ''}
                min={page.options?.minimumDate ? toInputDate(page.options.minimumDate) : undefined}
                max={page.options?.maximumDate ? toInputDate(page.options.maximumDate) : undefined}
                onChange={(e) => setDraft(e.target.value)}
              />
              {page.hintText && <div className="text-sm opacity-50 mt-2">{page.hintText}</div>}
            </div>
          </>
        );
      case 'input': {
        const multiline = page.options?.inputType === 'multiline';
        const common = {
          className: 'w-full rounded-xl bg-white dark:bg-[#2c2c2e] px-4 py-3 outline-none',
          placeholder: page.options?.placeholder || '',
          value: currentValue ?? '',
          onChange: (e: any) => setDraft(e.target.value),
        };
        return (
          <>
            {header}
            <div className="px-4">
              {page.options?.labelText && <div className="text-sm opacity-50 mb-1">{page.options.labelText}</div>}
              <div className="flex items-center gap-2">
                {page.options?.prefixText && <span className="opacity-60">{page.options.prefixText}</span>}
                {multiline ? <textarea rows={4} {...common} /> : <input type="text" {...common} />}
              </div>
              {page.hintText && <div className="text-sm opacity-50 mt-2">{page.hintText}</div>}
            </div>
          </>
        );
      }
      default:
        return <>{header}<div className="px-4 opacity-60 text-sm">Unsupported page type: {page.type}</div></>;
    }
  };

  const sheetTitle = showSplash ? splash?.header || received.title || 'Form' : showSummary ? 'Review' : page?.title || received.title || 'Form';

  return (
    <>
      <AppleBubble
        imageSrc={receivedImage || splashImage}
        style={received.style}
        title={received.title || splash?.header || 'Form'}
        subtitle={received.subtitle || splash?.splashtext || `${pages.length} step${pages.length === 1 ? '' : 's'}`}
        icon={<FileText size={18} />}
        onClick={() => setOpen(true)}
        disabled={readOnly}
      />
      {open && (
        <AppleSheet
          title={sheetTitle}
          onClose={onClose}
          onConfirm={showSplash ? () => setShowSplash(false) : showSummary ? () => finish() : next}
          confirmLabel={showSplash ? splash?.buttonTitle || 'Start' : showSummary ? 'Submit' : isLast(page) ? 'Done' : 'Next'}
          confirmDisabled={!showSplash && !showSummary && !valid}
        >
          {showSplash ? (
            <div className="flex flex-col items-center text-center gap-4 p-6">
              {splashImage && <div className="w-full h-40 rounded-xl overflow-hidden"><AppleImage src={splashImage} alt={splash?.header} /></div>}
              {splash?.header && <div className="font-bold text-2xl">{splash.header}</div>}
              {splash?.splashtext && <div className="opacity-70">{splash.splashtext}</div>}
              <button type="button" className="w-full rounded-xl bg-[var(--apple-accent)] text-[var(--apple-accent-fg)] font-semibold py-3" onClick={() => setShowSplash(false)}>{splash?.buttonTitle || 'Start'}</button>
            </div>
          ) : showSummary ? (
            <div className="mt-4 mx-4 rounded-xl overflow-hidden mb-4">
              {Object.entries(answers).map(([id, v]) => (
                <button key={id} type="button" className={rowClass} onClick={() => { setShowSummary(false); setHistory((h) => (h.includes(id) ? h.slice(0, h.indexOf(id) + 1) : [...h, id])); }}>
                  <div className="flex-1 py-2 min-w-0">
                    <div className="text-sm opacity-50">{pageById[id]?.title || pageById[id]?.subtitle || id}</div>
                    <div className="break-words">{displayValue(pageById[id], v)}</div>
                  </div>
                  <ChevronRight size={16} className="opacity-30" />
                </button>
              ))}
            </div>
          ) : (
            <>
              {(history.length > 1 || splash) && (
                <button type="button" className="flex items-center gap-1 text-[#007aff] px-4 pt-3" onClick={back}><ChevronLeft size={18} />Back</button>
              )}
              {renderPage()}
              <div className="h-6" />
            </>
          )}
        </AppleSheet>
      )}
    </>
  );
}

function toInputDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export default AppleInteractiveMessage;
