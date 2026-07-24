'use client';

import { Bell, X } from "lucide-react";
import React, { useCallback } from "react";
import { useDispatch } from "react-redux";

import { setDataInAppInfoReducer } from "@/store/appInfo/appInfoSlice";
import { removeNotification, setHelloEventMessage } from "@/store/chat/chatSlice";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { generateNewId } from "@/utils/utilities";
import { useColor } from "../Chatbot/hooks/useColor";
import { useChatActions } from "../Chatbot/hooks/useChatActions";

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

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const buildIframeSrcDoc = (html: string) => {
    // If content already has full HTML structure, use as-is; otherwise wrap it.
    const hasHtmlTag = /<html[\s>]/i.test(html);
    if (hasHtmlTag) return html;
    return `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:transparent;overflow:hidden}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--background)]">
      {/* Notification List */}
      <div className="flex-1 overflow-y-auto pb-5">
        <div className="w-full max-w-5xl mx-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Bell size={40} className="opacity-20 mb-4" style={{ color: 'var(--foreground)' }} />
            <p className="text-sm opacity-50" style={{ color: 'var(--foreground)' }}>No notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification, idx) => {
              const timeLabel = formatTime(notification.timestamp);
              const srcDoc = buildIframeSrcDoc(notification.content);
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
                          {timeLabel}
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
                      <div className="mb-3 rounded-lg overflow-hidden border border-[var(--foreground)]/10 bg-white">
                        <iframe
                          srcDoc={srcDoc}
                          sandbox="allow-same-origin"
                          className="w-full block h-[160px] border-none pointer-events-none"
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
