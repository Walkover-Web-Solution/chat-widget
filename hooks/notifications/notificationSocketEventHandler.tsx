// useNotificationSocketEventHandler.ts
// Handles push-notification socket events from the notification channel.
// 'Popup' / 'Custom' types are forwarded to the parent window for overlay rendering.
// 'Message' type notifications are stored in Redux (state.Chat.notifications)
// and trigger a launcher preview popup via the parent widget script.
import { addNotification } from '@/store/chat/chatSlice';
import { useAppDispatch } from '@/store/useTypedHooks';
import { emitEventToParent } from '@/utils/emitEventsToParent/emitEventsToParent';
import { generateNewId } from '@/utils/utilities';
import { useCallback, useEffect } from 'react';
import socketManager from './notificationSocketManager';

/**
 * Hook that subscribes to the notification socket channel ("NewPublish" events)
 * and dispatches the appropriate actions based on notification type.
 */
export const useNotificationSocketEventHandler = ({ chatSessionId }: { chatSessionId: string }) => {
    const dispatch = useAppDispatch();

    const handleNewMessage = useCallback((data: any, acknowledgement: any) => {
        const { response } = data;
        const { message } = response || {};
        const { type, message_type, content = null } = message || {};
        switch (type) {
            case 'notification':
                if (!content) return;
                if (message_type === 'Popup' || message_type?.toLowerCase() === 'custom') {
                    emitEventToParent('PUSH_NOTIFICATION', message)
                } else if (message_type === 'Message') {
                    const notificationId = generateNewId();
                    dispatch(addNotification({
                        id: notificationId,
                        content: message?.content || '',
                        timestamp: Date.now(),
                    }))
                    // Pass the notification id along so the parent widget can echo it back
                    // via OPEN_WITH_NOTIFICATION, letting us remove/mark it read on open.
                    emitEventToParent('LAUNCHER_MESSAGE_PREVIEW', { ...message, notificationId })
                }
                if (acknowledgement && typeof acknowledgement === 'function') {
                    acknowledgement(message)
                }
                break;
            default:
                // Handle other types if needed
                break;
        }
    }, [dispatch]);

    useEffect(() => {
        socketManager.on("NewPublish", handleNewMessage);

        return () => {
            socketManager.off("NewPublish", handleNewMessage);
        };
    }, [handleNewMessage, socketManager?.isConnected]);

    // Return values and methods that might be useful to the component
    return null;
};

export default useNotificationSocketEventHandler;