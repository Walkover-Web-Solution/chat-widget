import { useContext, useEffect } from 'react';
import { ChatbotContext } from '@/components/context';
import useHelloIntegration from './useHelloIntegration';
import useSocket from '@/hooks/socket';
import useNotificationSocket from '@/hooks/notifications/notificationSocket';

export const useHelloIntegrationEffects = (params: Parameters<typeof useHelloIntegration>[0]) => {
    const actions = useHelloIntegration(params);
    const { isHelloUser } = useContext(ChatbotContext);

    useSocket({ chatSessionId: actions.chatSessionId });
    useNotificationSocket({ chatSessionId: actions.chatSessionId });

    // Effect to fetch previous history when channel changes
    useEffect(() => {
        if (isHelloUser && actions.currentChannelId) {
            actions.fetchHelloPreviousHistory();
        }
    }, [actions.currentChannelId, isHelloUser]);

    // Effect to initialize Hello services when redux chat session ID changes
    useEffect(() => {
        if (actions.reduxChatSessionId) {
            const widgetToken = actions.reduxChatSessionId?.split('_')[0]; // Extract first part (e.g., "d1bc7")
            actions.initializeHelloServices(widgetToken);
        }
    }, [actions.reduxChatSessionId]);

    return actions;
};

// Export default for backward compatibility
export default useHelloIntegrationEffects;