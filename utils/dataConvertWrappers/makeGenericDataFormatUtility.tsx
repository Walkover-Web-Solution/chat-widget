import { generateNewId, getLocalStorage } from "../utilities";
import { readShowMore } from "../readMore";

/**
 * Pick the id of the message being replied to, from whatever field the
 * server / socket happens to send it in. Kept in one place so field-name
 * drift only needs a single edit.
 */
function pickRepliedMsgId(m: any): string | undefined {
    const id = m?.replied_msg_id
        || m?.replied_on
        || m?.replied_message_id
        || m?.reply_to_id
        || m?.context?.id
        || m?.content?.context?.id
        || m?.replied_msg_content?.id
        || m?.replied_msg_content?._id
        || m?.replied_msg_content?.message_id
        || undefined;

    if (!id && m?.replied_msg_content && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[pickRepliedMsgId] message has replied_msg_content but no matching id field. Raw message:', m);
    }

    return id;
}

/**
 * Collects every id-like value a single message might be known by
 * (client-side timetoken, server _id, message_id, etc). A reply pill's
 * target reference may use any one of these depending on whether the data
 * came from a live socket event or a persisted history fetch, so we tag the
 * rendered message with all of them and match against any.
 */
function pickAllIds(...sources: any[]): string[] {
    const ids = new Set<string>();
    for (const s of sources) {
        if (s === undefined || s === null) continue;
        ids.add(String(s));
    }
    return Array.from(ids);
}

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
                            all_ids: pickAllIds(chat?.id, chat?.message?.id, chat?.message?._id, chat?.message?.message_id, chat?.timetoken),
                            from_name: chat?.message?.dynamic_values?.agent_name,
                            message_type: 'feedback',
                            token: chat?.message?.token,
                            feedback_msg: chat?.message?.feedback_msg,
                            rating: chat?.message?.rating,
                            dynamic_values: chat?.message?.dynamic_values,
                            chat_id: chat?.message?.chat_id,
                            channel: chat?.message?.channel,
                            time: chat?.timetoken || null,
                            sender_id: chat?.message?.sender_id,
                            replied_msg_content: chat?.message?.replied_msg_content,
                            replied_msg_sender_id: chat?.message?.replied_msg_sender_id,
                            replied_msg_type: chat?.message?.replied_msg_type,
                            replied_from_name: chat?.message?.replied_from_name,
                            replied_msg_id: pickRepliedMsgId(chat?.message)
                        };
                    }
                    if (chat?.message?.message_type === 'voice_call') {
                        return {
                            role: "voice_call",
                            from_name: chat?.message?.from_name,
                            content: chat?.message?.content,
                            urls: chat?.message?.content?.attachment,
                            id: chat?.id || chat?.message?.id || chat?.timetoken,
                            all_ids: pickAllIds(chat?.id, chat?.message?.id, chat?.message?._id, chat?.message?.message_id, chat?.timetoken),
                            message_type: chat?.message?.message_type,
                            messageJson: chat?.message?.content?.interactive || chat?.message?.content,
                            time: chat?.timetoken || null,
                            sender_id: chat?.message?.sender_id,
                            is_auto_response: chat?.message?.is_auto_response,
                            replied_msg_content: chat?.message?.replied_msg_content?.interactive || chat?.message?.replied_msg_content,
                            replied_msg_sender_id: chat?.message?.replied_msg_sender_id,
                            replied_msg_type: chat?.message?.replied_msg_type,
                            replied_from_name: chat?.message?.replied_from_name,
                            replied_msg_id: pickRepliedMsgId(chat?.message)
                        };
                    }

                    return {
                        role,
                        id: chat?.id || chat?.message?.id || chat?.timetoken,
                        all_ids: pickAllIds(chat?.id, chat?.message?.id, chat?.message?._id, chat?.message?.message_id, chat?.timetoken),
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
                        replied_from_name: chat?.message?.replied_from_name,
                        replied_msg_id: pickRepliedMsgId(chat?.message)
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
            all_ids: pickAllIds(message?.id, message?.message?.id, message?.message?._id, message?._id, message?.message_id, message?.timetoken),
            message_type: 'feedback',
            token: message?.token,
            feedback_msg: message?.feedback_msg,
            rating: message?.rating,
            dynamic_values: message?.dynamic_values,
            chat_id: message?.chat_id,
            channel: message?.channel,
            time: message?.timetoken || null,
            sender_id: message?.sender_id,
            is_auto_response,
            replied_msg_content: message?.replied_msg_content,
            replied_msg_sender_id: message?.replied_msg_sender_id,
            replied_msg_type: message?.replied_msg_type,
            replied_from_name: message?.replied_from_name,
            replied_msg_id: pickRepliedMsgId(message)
        }];
    }

    if (type === 'chat' && message_type === 'voice_call') {
        return [{
            role: "voice_call",
            from_name,
            content: content,
            urls: content?.body?.attachment || content?.attachment,
            id: message?.id || message?.message?.id || message?.timetoken,
            all_ids: pickAllIds(message?.id, message?.message?.id, message?.message?._id, message?._id, message?.message_id, message?.timetoken),
            message_type: message?.message_type,
            messageJson: message?.content?.interactive || message?.content,
            time: message?.timetoken || null,
            sender_id: message?.sender_id,
            is_auto_response,
            replied_msg_content: message?.replied_msg_content?.interactive || message?.replied_msg_content,
            replied_msg_sender_id: message?.replied_msg_sender_id,
            replied_msg_type: message?.replied_msg_type,
            replied_from_name: message?.replied_from_name,
            replied_msg_id: pickRepliedMsgId(message)
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
        all_ids: pickAllIds(message?.id, message?.message?.id, message?.message?._id, message?._id, message?.message_id, message?.timetoken),
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
        replied_from_name: message?.replied_from_name,
        replied_msg_id: pickRepliedMsgId(message)
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
