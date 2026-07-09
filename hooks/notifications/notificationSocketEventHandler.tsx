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
                    dispatch(addNotification({
                        id: generateNewId(),
                        content: message?.content || '',
                        timestamp: Date.now(),
                    }))
                    emitEventToParent('LAUNCHER_MESSAGE_PREVIEW', message)
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

    useEffect(() => {
        const customFakeEvent = {
            "response": {
                "channel": "ch-comp-278060.6a4cead4b16226411feca402",
                "message": {
                    "type": "notification",
                    "message_type": "Message",
                    "content": "<!DOCTYPE html>\n<html>\n<head>\n<style>\n*{\n    box-sizing:border-box;\n    font-family:Arial,Helvetica,sans-serif;\n}\n\nbody{\n    margin:0;\n    display:flex;\n    justify-content:center;\n    align-items:center;\n    min-height:100vh;\n    background:#f5f5f5;\n}\n\n.notification-card{\n    width:320px;\n    display:flex;\n    overflow:hidden;\n    border-radius:12px;\n    border:1px solid #e5e5e5;\n    background:#fff;\n    box-shadow:0 8px 24px rgba(0,0,0,.12);\n}\n\n.notification-image{\n    position:relative;\n    width:105px;\n    min-width:105px;\n    background:linear-gradient(135deg,#ff5c8a,#ff7d7d);\n    overflow:hidden;\n}\n\n.notification-image img{\n    width:78px;\n    position:absolute;\n    right:-8px;\n    bottom:8px;\n    transform:rotate(-12deg);\n}\n\n.sale-text{\n    position:absolute;\n    top:12px;\n    left:12px;\n    color:#fff;\n    z-index:2;\n}\n\n.sale-text span{\n    display:block;\n    font-size:20px;\n    font-weight:700;\n    line-height:1;\n}\n\n.sale-text strong{\n    display:block;\n    margin-top:2px;\n    font-size:16px;\n}\n\n.notification-content{\n    padding:14px;\n    flex:1;\n}\n\n.notification-content h3{\n    margin:0 0 6px;\n    font-size:16px;\n    color:#222;\n}\n\n.notification-content p{\n    margin:0;\n    color:#666;\n    font-size:13px;\n    line-height:1.5;\n}\n\n.notification-content button{\n    margin-top:14px;\n    border:none;\n    background:#ff4f87;\n    color:#fff;\n    padding:8px 14px;\n    border-radius:8px;\n    cursor:pointer;\n    font-weight:600;\n}\n\n.notification-content button:hover{\n    background:#e93f75;\n}\n</style>\n</head>\n<body>\n<div class=\"notification-card\">\n    <div class=\"notification-image\">\n        <div class=\"sale-text\">\n            <span>50% OFF</span>\n            <strong>TODAY!</strong>\n        </div>\n        <img src=\"https://picsum.photos/150/200\" alt=\"Product\">\n    </div>\n    <div class=\"notification-content\">\n        <h3>50% OFF Today! 🎉</h3>\n        <p>Save up to 50% on all shoes.<br>Limited time only. Don't miss out!</p>\n        <button>Shop Now</button>\n    </div>\n</div>\n</body>\n</html>",
                    "horizontal_position": "center",
                    "vertical_position": "center",
                    "node_id": "22897",
                    "template_name": "black_box_msg_type",
                    "campaign_name": "black-box",
                    "company_id": 278060,
                    "status_uuid": "4b89d5e1d2874cc1a8f20473b26c4913",
                    "contact_id": "f6a6d6f7-b590-42e8-a9e2-6c2bf7fc89ff",
                    "campaign_request_id": "1783427085_3e80c7f84ad719fa20ecf5808afa1013",
                    "height": null,
                    "width": null,
                    "ttl": 86400,
                    "sentAt": "Tue, 07 Jul 2026 12:26:49 GMT"
                }
            }
        };

        const intervalId = setInterval(() => {
            console.log("Triggering fake NewPublish event");
            handleNewMessage(customFakeEvent, () => { });
        }, 30000);

        return () => clearInterval(intervalId);
    }, [handleNewMessage]);

    // Return values and methods that might be useful to the component
    return null;
};

export default useNotificationSocketEventHandler;