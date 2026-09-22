import { generateNewId, getLocalStorage } from "../utilities";
import { readShowMore } from "../readMore";

/**
 * Converts chat history to generic format.
 * @param history - The chat history to convert.
 * @param isHello - Whether the chat history is from Hello.
 * @returns The converted chat history.
 */
function convertChatHistoryToGenericFormat(history: any, isHello: boolean = false) {
    const clientId = getLocalStorage('k_clientId') || getLocalStorage('a_clientId');
    switch (isHello) {
        case true:
            return history
                .map((chat: any) => {
                    const msg = chat?.message;
                    // Own message: has a chat_id and either no client_sender_id (legacy) or one that matches this client
                    const isOwnMessage = !!msg?.chat_id && (!msg?.client_sender_id || msg?.client_sender_id === clientId);

                    let role;
                    if (msg?.message_type === 'voice_call') {
                        role = "voice_call"
                    } else if (isOwnMessage) {
                        role = 'user'
                    } else if (msg?.sender_id === 'workflow' || msg?.sender_id === 'bot' || msg?.is_auto_response) {
                        role = "Bot"
                    } else {
                        role = "Human"
                    }

                    // Handle feedback type messages
                    if (chat?.message?.type === 'feedback') {
                        return {
                            role: "Human",
                            id: chat?.id || chat?.message?.id || chat?.timetoken,
                            from_name: chat?.message?.dynamic_values?.agent_name,
                            message_type: 'feedback',
                            token: chat?.message?.token,
                            dynamic_values: chat?.message?.dynamic_values,
                            chat_id: chat?.message?.chat_id,
                            channel: chat?.message?.channel,
                            time: chat?.timetoken || null,
                            sender_id: chat?.message?.sender_id,
                            replied_msg_content: chat?.message?.replied_msg_content,
                            replied_msg_sender_id: chat?.message?.replied_msg_sender_id,
                            replied_msg_type: chat?.message?.replied_msg_type,
                            replied_from_name: chat?.message?.replied_from_name
                        };
                    }
                    if (chat?.message?.message_type === 'voice_call') {
                        return {
                            role: "voice_call",
                            from_name: chat?.message?.from_name,
                            content: chat?.message?.content,
                            urls: chat?.message?.content?.attachment,
                            id: chat?.id || chat?.message?.id || chat?.timetoken,
                            message_type: chat?.message?.message_type,
                            messageJson: chat?.message?.content?.interactive || chat?.message?.content,
                            time: chat?.timetoken || null,
                            sender_id: chat?.message?.sender_id,
                            is_auto_response: chat?.message?.is_auto_response,
                            replied_msg_content: chat?.message?.replied_msg_content?.interactive || chat?.message?.replied_msg_content,
                            replied_msg_sender_id: chat?.message?.replied_msg_sender_id,
                            replied_msg_type: chat?.message?.replied_msg_type,
                            replied_from_name: chat?.message?.replied_from_name
                        };
                    }

                    return {
                        role,
                        id: chat?.id || chat?.message?.id || chat?.timetoken,
                        message_id: chat?.message?.message_id || chat?.id || chat?.message?.id,
                        show_more: readShowMore(chat?.message?.content) || readShowMore(chat?.message),
                        from_name: chat?.message?.from_name,
                        content: chat?.message?.message_type === 'interactive'
                            ? chat?.message?.content?.body?.text
                            : chat?.message?.content?.text,
                        urls: chat?.message?.content?.attachment,
                        message_type: chat?.message?.message_type,
                        messageJson: chat?.message?.content?.interactive || chat?.message?.content,
                        time: chat?.timetoken,
                        sender_id: chat?.message?.sender_id,
                        is_auto_response: chat?.message?.is_auto_response,
                        replied_msg_content: chat?.message?.replied_msg_content?.interactive || chat?.message?.replied_msg_content,
                        replied_msg_sender_id: chat?.message?.replied_msg_sender_id,
                        replied_msg_type: chat?.message?.replied_msg_type,
                        replied_from_name: chat?.message?.replied_from_name
                    };
                })

        case false:
            return (Array.isArray(history) ? history : []).map((msgObj: any) => {
                return {
                    ...msgObj,
                    id: msgObj?.Id,
                    content: msgObj?.chatbot_message || msgObj?.content,
                    role: msgObj?.role,
                    createdAt: msgObj?.createdAt,
                    function: msgObj?.function,
                    tools_call_data: msgObj?.tools_call_data,
                    created_at: msgObj?.created_at,
                    error: msgObj?.error,
                    urls: msgObj?.urls
                }
            });

        default:
            return [];
    }
}

function createSendMessageHelloPayload(message: string) {
    return {
        message: message
    };
}

/**
 * Converts an event message to generic format.
 * @param message - The event message to convert.
 * @param isHello - Whether the event message is from Hello.
 * @returns The converted event message.
 */
function convertEventMessageToGenericFormat(message: any, isHello: boolean = false) {
    if (!isHello) {
        return [{
            ...message,
            id: message?.Id || generateNewId(),
            content: message?.chatbot_message || message?.content,
            role: message?.role,
            createdAt: message?.createdAt,
            function: message?.function,
            tools_call_data: message?.tools_call_data,
            created_at: message?.created_at,
            error: message?.error,
            urls: message?.urls
        }]
    }


    const { sender_id, from_name, content, type, is_auto_response, message_type, client_sender_id } = message || {};
    const clientId = getLocalStorage('k_clientId') || getLocalStorage('a_clientId');

    // Handle feedback type messages    
    if (type === 'feedback') {
        return [{
            role: "Human",
            from_name: message?.dynamic_values?.agent_name,
            id: message?.id || message?.message?.id || message?.timetoken,
            message_type: 'feedback',
            token: message?.token,
            dynamic_values: message?.dynamic_values,
            chat_id: message?.chat_id,
            channel: message?.channel,
            time: message?.timetoken || null,
            sender_id: message?.sender_id,
            is_auto_response,
            replied_msg_content: message?.replied_msg_content,
            replied_msg_sender_id: message?.replied_msg_sender_id,
            replied_msg_type: message?.replied_msg_type,
            replied_from_name: message?.replied_from_name
        }];
    }

    if (type === 'chat' && message_type === 'voice_call') {
        return [{
            role: "voice_call",
            from_name,
            content: content,
            urls: content?.body?.attachment || content?.attachment,
            id: message?.id || message?.message?.id || message?.timetoken,
            message_type: message?.message_type,
            messageJson: message?.content?.interactive || message?.content,
            time: message?.timetoken || null,
            sender_id: message?.sender_id,
            is_auto_response,
            replied_msg_content: message?.replied_msg_content?.interactive || message?.replied_msg_content,
            replied_msg_sender_id: message?.replied_msg_sender_id,
            replied_msg_type: message?.replied_msg_type,
            replied_from_name: message?.replied_from_name
        }];
    }

    // Decide which side the bubble renders on (right = "user", left = "Bot" / "Human")
    // Own message: legacy "user" sender, or a client_sender_id that matches this client
    const isOwnMessage = sender_id === "user" || (!!clientId && client_sender_id === clientId);
    const isBotMessage = sender_id === "bot" || sender_id === "workflow" || !!is_auto_response;
    // Anyone else who identifies themselves (agent via sender_id, peer via client_sender_id) is "Human"
    const isOtherSender = !!sender_id || !!client_sender_id;

    const role = isOwnMessage ? "user"
        : isBotMessage ? "Bot"
        : isOtherSender ? "Human"
        : "user"; // no sender info at all: treat as our own message

    // Handle regular messages
    return [{
        role,
        from_name,
        content: content?.body?.text || content?.text,
        urls: content?.body?.attachment || content?.attachment,
        id: message?.id || message?.message?.id || message?.timetoken,
        message_id: message?.message_id || message?.id || message?.message?.id,
        show_more: readShowMore(content) || readShowMore(message),
        message_type: message?.message_type,
        messageJson: message?.content?.interactive || message?.content,
        time: message?.timetoken || null,
        sender_id: message?.sender_id,
        is_auto_response,
        replied_msg_content: message?.replied_msg_content?.interactive || message?.replied_msg_content,
        replied_msg_sender_id: message?.replied_msg_sender_id,
        replied_msg_type: message?.replied_msg_type,
        replied_from_name: message?.replied_from_name
    }];
}

function createSendMessageGtwyPayload(message: string) {
    return {
        message: message
    };
}

export {
    convertChatHistoryToGenericFormat,
    convertEventMessageToGenericFormat, createSendMessageGtwyPayload, createSendMessageHelloPayload
};
