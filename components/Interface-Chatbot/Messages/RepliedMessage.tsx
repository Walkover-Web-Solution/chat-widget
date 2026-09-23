import RenderHelloAttachmentMessage from "@/components/Hello/RenderHelloAttachmentMessage";
import RenderHelloInteractiveMessage from "@/components/Hello/RenderHelloInteractiveMessage";
import RenderHelloVedioCallMessage from "@/components/Hello/RenderHelloVedioCallMessage";
import { useScrollToRepliedMessage } from "@/components/Chatbot/hooks/useHelloIntegration";
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import React, { useState } from "react";
import InterfaceMarkdown from "../Interface-Markdown/InterfaceMarkdown";
import { MESSAGE_TYPES } from "./MessageType";

const RepliedMessage = ({ chatSessionId, message }: { chatSessionId: string; message: any }) => {
    const scrollToRepliedMessage = useScrollToRepliedMessage();
    const [isSearching, setIsSearching] = useState(false);

    if (message?.replied_msg_type !== 'interactive' &&
        !message?.replied_msg_content?.text &&
        !(message?.replied_msg_content?.attachment && message?.replied_msg_content?.attachment?.length > 0)) {
        return null;
    }

    const senderId = message?.replied_msg_sender_id;
    const fromName = message?.replied_from_name;
    const senderName = fromName ? getSenderNameFromName(fromName) : (typeof senderId === 'string'
        ? getSenderNameFromId(senderId)
        : senderId ? "" : 'You');

    const repliedMsgId = message?.replied_msg_id;

    const handleScrollToOriginal = async (e: React.SyntheticEvent) => {
        e.stopPropagation();
        if (!repliedMsgId) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[RepliedMessage] no replied_msg_id on message, cannot scroll. Raw message:', message);
            }
            return;
        }
        if (isSearching) return;

        setIsSearching(true);
        try {
            // Tries the DOM first; if the original message isn't loaded yet
            // (older history not paginated in), this fetches older pages
            // until it's found or history is exhausted.
            await scrollToRepliedMessage(repliedMsgId);
        } finally {
            setIsSearching(false);
        }
    };

    function getSenderNameFromId(id: string) {
        switch (id?.toLowerCase()) {
            case "user":
                return "You";
            case "workflow":
                return "";
            case "auto response":
                return "";
            // case "bot":
            //     return "Bot";
            default:
                // return id?.charAt(0).toUpperCase() + id?.slice(1);
                return ""
        }
    }

    function getSenderNameFromName(name: string) {
        switch (name?.toLowerCase()) {
            case "user":
                return "You";
            case "workflow":
                return "";
            case "auto response":
                return "";
            // case "bot":
            //     return "Bot";
            default:
                return name;
        }
    }

    return (
        <div
            onClick={handleScrollToOriginal}
            role={repliedMsgId ? 'button' : undefined}
            tabIndex={repliedMsgId ? 0 : undefined}
            onKeyDown={repliedMsgId ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleScrollToOriginal(e); } : undefined}
            className={`${repliedMsgId ? 'cursor-pointer hover:brightness-95 transition' : ''} ${isSearching ? 'opacity-60' : ''} mb-1 p-2 rounded-md border-l-2 not-prose ${message?.role !== 'user' ? 'bg-gray-200 dark:bg-gray-800 border-blue-400' : 'bg-black bg-opacity-10 border-white'}`}
        >
            <div className={`text-xs text-gray-600 mb-1 font-medium ${message?.role !== 'user' ? 'dark:text-gray-200' : 'text-inherit'}`}>{senderName}</div>
            <div className="pointer-events-none">
                {message.replied_msg_type === MESSAGE_TYPES.INTERACTIVE ? (
                    <RenderHelloInteractiveMessage message={{ messageJson: message.replied_msg_content }} />
                ) :
                    message.replied_msg_type === MESSAGE_TYPES.ATTACHMENT || message.replied_msg_type === MESSAGE_TYPES.TEXT_ATTACHMENT ? (
                        <RenderHelloAttachmentMessage message={{ messageJson: message.replied_msg_content }} isBot={message.replied_msg_sender_id || false} />
                    ) : message.replied_msg_type === MESSAGE_TYPES.VIDEO_CALL ? (<RenderHelloVedioCallMessage message={{ messageJson: message.replied_msg_content }} />)
                        : (
                            <div className={`text-sm text-gray-700 ${message?.role !== 'user' ? 'dark:text-gray-200' : 'text-inherit'}`}>
                                {(() => {
                                    const isBotMessage = senderId && typeof senderId === 'string' && senderId.toLowerCase() !== 'user';
                                    const replyContent = (() => {
                                        if (typeof message.replied_msg_content === 'string') {
                                            return message.replied_msg_content;
                                        }
                                        const replyText = message.replied_msg_content?.text || '';
                                        const hasAttachment = message.replied_msg_content?.attachment &&
                                            message.replied_msg_content.attachment.length > 0;

                                        if (replyText.trim()) {
                                            return replyText;
                                        }
                                        if (hasAttachment) {
                                            return "Attachment";
                                        }
                                        return "Message";
                                    })();

                                    if (isBotMessage) {
                                        return <InterfaceMarkdown>{replyContent}</InterfaceMarkdown>;
                                    }
                                    return <div dangerouslySetInnerHTML={{ __html: replyContent }}></div>;
                                })()}
                            </div>
                        )}
            </div>
        </div>
    );
}

export default React.memo(addUrlDataHoc(RepliedMessage, []));
