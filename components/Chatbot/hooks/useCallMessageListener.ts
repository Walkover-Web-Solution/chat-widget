import { useEffect } from 'react';
import helloVoiceService from './HelloVoiceService';
import { useHelloContext, useHelloMessages } from './useHelloIntegration';
import { useReduxStateManagement } from './useReduxManagement';
import { generateNewId } from '@/utils/utilities';
import { useChatActions } from './useChatActions';

export const useCallMessageListener = () => {
    const { chatSessionId } = useHelloContext();
    const { addHelloMessage } = useHelloMessages();
    const { setNewMessage } = useChatActions();

    const { currentChannelId, currentChatId } = useReduxStateManagement({
        chatSessionId,
        tabSessionId: useHelloContext().tabSessionId
    });

    useEffect(() => {
        const handleMessageReceived = ({ message, from, timestamp = Date.now() }: any) => {
            console.log('call message', message, from, timestamp);
            if (message) {
                const messageId = generateNewId(24);
                const newMessage = {
                    id: messageId,
                    role: "bot_call",
                    chat_id: currentChatId || generateNewId(),
                    content: {
                        text: message,
                        attachment: []
                    },
                    timetoken: timestamp,
                    sender_id: "bot_call"
                };
                addHelloMessage(newMessage, currentChannelId);
                setNewMessage(true);
            }
        };

        helloVoiceService.addEventListener("call-message", handleMessageReceived);

        return () => {
            helloVoiceService.removeEventListener("call-message", handleMessageReceived);
        };
    }, [addHelloMessage, currentChannelId, currentChatId, setNewMessage]);
};