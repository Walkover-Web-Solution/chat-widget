'use client';

import { Bell, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { setDataInAppInfoReducer } from "@/store/appInfo/appInfoSlice";
import { removeNotification, setHelloEventMessage } from "@/store/chat/chatSlice";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { generateNewId } from "@/utils/utilities";
import { useColor } from "../Chatbot/hooks/useColor";
import { useChatActions } from "../Chatbot/hooks/useChatActions";

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const RelativeTimeLabel = ({ timestamp }: { timestamp: number }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const elapsed = Date.now() - timestamp;
      const msUntilNextMinute = 60000 - (elapsed % 60000);
      timeoutId = setTimeout(() => {
        setTick((tick) => tick + 1);
        scheduleNext();
      }, Math.max(msUntilNextMinute, 1000) + 50);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [timestamp]);

  return <>{formatRelativeTime(timestamp)}</>;
};

const SKIP_MEASURE_TAGS: Record<string, number> = { SCRIPT: 1, STYLE: 1, META: 1, TITLE: 1, LINK: 1, NOSCRIPT: 1, HEAD: 1 };

const previewResetCss = `html,body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;width:100%!important;max-width:100%!important;background:transparent!important;background-color:transparent!important;color-scheme:light!important;overflow:hidden!important;display:block!important;align-items:unset!important;justify-content:unset!important}body>*{max-width:100%!important;box-sizing:border-box!important}img{max-width:100%;height:auto}`;

const buildIframeSrcDoc = (html: string) => {
  const hasHtmlTag = /<html[\s>]/i.test(html);
  if (hasHtmlTag) {
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `<style>${previewResetCss}</style></head>`);
    }
    return html.replace(/<html([^>]*)>/i, `<html$1><head><style>${previewResetCss}</style></head>`);
  }
  return `<!DOCTYPE html><html><head><style>${previewResetCss}</style></head><body>${html}</body></html>`;
};

const neutralizePageLayout = (doc: Document) => {
  [doc.documentElement, doc.body].forEach((el) => {
    if (!el) return;
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('color-scheme', 'light', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('display', 'block', 'important');
  });
};

const measureContentSize = (frame: HTMLIFrameElement) => {
  if (frame.clientWidth < 40) return { width: 0, height: 0 };
  const doc = frame.contentDocument;
  const body = doc?.body;
  if (!doc || !body) return { width: 0, height: 0 };
  neutralizePageLayout(doc);
  let width = 0;
  let height = 0;
  for (let i = 0; i < body.children.length; i++) {
    const el = body.children[i] as HTMLElement;
    if (SKIP_MEASURE_TAGS[el.tagName]) continue;
    const cs = doc.defaultView?.getComputedStyle(el);
    const mt = parseFloat(cs?.marginTop || '0') || 0;
    const mb = parseFloat(cs?.marginBottom || '0') || 0;
    const ml = parseFloat(cs?.marginLeft || '0') || 0;
    const mr = parseFloat(cs?.marginRight || '0') || 0;
    width = Math.max(width, (el.offsetWidth || 0) + ml + mr);
    height += Math.max(el.offsetHeight || 0, el.scrollHeight || 0) + mt + mb;
  }
  return { width: Math.ceil(width), height: Math.ceil(height) };
};

const NotificationHtmlIframe = ({ html, title }: { html: string; title: string }) => {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  const [width, setWidth] = useState<number | string>('100%');
  const srcDoc = buildIframeSrcDoc(html);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    const timers: number[] = [];

    const applySize = () => {
      if (cancelled) return false;
      const size = measureContentSize(frame);
      if (size.height >= 40) {
        setHeight(Math.min(size.height + 2, 400));
        const maxW = frame.parentElement?.clientWidth || frame.clientWidth;
        if (size.width >= 40 && maxW > 0) {
          setWidth(Math.min(size.width + 2, maxW));
        }
        if (frame.contentDocument?.documentElement) frame.contentDocument.documentElement.scrollTop = 0;
        if (frame.contentDocument?.body) frame.contentDocument.body.scrollTop = 0;
        frame.contentWindow?.scrollTo(0, 0);
        return true;
      }
      return false;
    };

    const schedule = () => {
      applySize();
      requestAnimationFrame(applySize);
      [50, 120, 250, 500, 1000].forEach((ms) => {
        timers.push(window.setTimeout(applySize, ms));
      });
    };

    frame.addEventListener('load', schedule);
    if (frame.contentDocument?.readyState === 'complete') {
      schedule();
    }

    const resizeObserver = new ResizeObserver(() => {
      applySize();
    });
    resizeObserver.observe(frame);

    return () => {
      cancelled = true;
      frame.removeEventListener('load', schedule);
      resizeObserver.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={frameRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="block border-none bg-transparent rounded-[14px] mx-auto"
      style={{ height, width, maxWidth: '100%', minHeight: 80, background: 'transparent', colorScheme: 'light', borderRadius: 14 }}
      title={title}
    />
  );
};

/**
 * NotificationPage — displays a list of push notifications (message_type: "Message")
 * received from campaigns via the notification socket channel.
 *
 * Each notification is rendered in a sandboxed iframe (via buildIframeSrcDoc) to safely
 * display the raw HTML content. Users can dismiss notifications (X button) or initiate
 * a new chat based on the notification ("Chat with us" button).
 *
 * "Chat with us" opens a fresh chat thread with the notification content shown as a
 * bot-side message (rendered via ShadowDomComponent with message_type: 'pushNotification').
 */
const NotificationPage = () => {
  const dispatch = useDispatch();
  const { primaryTextColor, primaryTintColor } = useColor();
  const { setImages } = useChatActions();

  const { notifications, images } = useCustomSelector((state) => ({
    notifications: state.Chat.notifications || [],
    images: state.Chat.images || [],
  }));

  const handleDismiss = useCallback((e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    dispatch(removeNotification(notificationId));
  }, [dispatch]);

  const handleChatWithUs = useCallback((notification: { id: string; content: string; timestamp: number; read: boolean }) => {
    dispatch(removeNotification(notification.id));
    if (images?.length > 0) setImages([]);
    // Generate a fresh sub-thread key so this new chat has its own bucket
    const newSubThreadId = `notification-${generateNewId()}`;
    // Reset to a fresh thread so a new chat is opened
    dispatch(setDataInAppInfoReducer({
      showNotificationView: false,
      subThreadId: newSubThreadId,
      currentTeamId: '',
      currentChannelId: '',
      currentChatId: '',
      overrideChannelId: '',
    }));
    // Push the notification as a bot-side message on the LEFT in the new chat
    // (rendered via ShadowDomComponent for pushNotification message_type)
    dispatch(setHelloEventMessage({
      subThreadId: newSubThreadId,
      message: {
        type: 'chat',
        message_type: 'pushNotification',
        sender_id: 'bot',
        is_auto_response: true,
        content: {
          text: notification.content,
          attachment: []
        },
        from_name: '',
        id: generateNewId(),
      }
    }));
  }, [dispatch, images, setImages]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--background)]">
      {/* Notification List */}
      <div className="flex-1 overflow-y-auto pb-5 max-h-[calc(100%_-_62px)]">
        <div className="w-full max-w-5xl mx-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Bell size={40} className="opacity-20 mb-4" style={{ color: 'var(--foreground)' }} />
            <p className="text-sm opacity-50" style={{ color: 'var(--foreground)' }}>No notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification, idx) => {
              const isLast = idx === notifications.length - 1;

              return (
                <div
                  key={notification.id}
                  className={`notification-card px-4 py-4 ${isLast ? '' : 'border-b border-[var(--foreground)]/5'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Bell icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: primaryTintColor || 'rgba(59, 130, 246, 0.1)' }}
                      >
                        <Bell size={16} style={{ color: primaryTextColor || '#3b82f6' }} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                          <RelativeTimeLabel timestamp={notification.timestamp} />
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors opacity-40 hover:opacity-100"
                            onClick={(e) => handleDismiss(e, notification.id)}
                            aria-label="Dismiss notification"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div
                        className="mb-3 overflow-hidden rounded-[14px] w-fit max-w-full mx-auto"
                        style={{
                          border: '1px solid color-mix(in srgb, var(--foreground) 16%, transparent)',
                          boxShadow: '0 1px 2px color-mix(in srgb, var(--foreground) 6%, transparent)',
                        }}
                      >
                        <NotificationHtmlIframe
                          html={notification.content}
                          title={`notification-${notification.id}`}
                        />
                      </div>
                      <button
                        className="text-xs font-semibold px-4 py-2 rounded-lg w-full transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: primaryTintColor || 'rgba(59, 130, 246, 0.1)',
                          color: primaryTextColor || '#3b82f6',
                          border: `1px solid ${primaryTextColor || '#3b82f6'}20`,
                        }}
                        onClick={() => handleChatWithUs(notification)}
                      >
                        Chat with us
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(NotificationPage);
