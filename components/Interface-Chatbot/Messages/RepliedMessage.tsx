import RenderHelloAttachmentMessage from "@/components/Hello/RenderHelloAttachmentMessage";
import RenderHelloInteractiveMessage from "@/components/Hello/RenderHelloInteractiveMessage";
import RenderHelloVedioCallMessage from "@/components/Hello/RenderHelloVedioCallMessage";
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { withAlpha } from "@/utils/themeUtility";
import React from "react";
import InterfaceMarkdown from "../Interface-Markdown/InterfaceMarkdown";
import { useColor } from "../../Chatbot/hooks/useColor";
import { MESSAGE_TYPES } from "./MessageType";

const RepliedMessage = ({ chatSessionId, message }: { chatSessionId: string; message: any }) => {
    const { primaryTextColor, primaryBgColor } = useColor();

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

    const isUser = message?.role === 'user';
    // Match the input-area ReplyPreview: a light card with a primary-colored
    // accent + sender name. On the primary-colored (outgoing) bubble we use a
    // near-opaque white so the purple doesn't bleed through and wash it out;
    // on white (incoming) bubbles a soft primary tint reads the same way.
    const replyBg = isUser
        ? 'rgba(255, 255, 255, 0.92)'
        : withAlpha(primaryBgColor, 0.08);
    const replyBorder = primaryTextColor;

    return (
        <div
            className="pointer-events-none mb-1 p-2 rounded-md border-l-4 not-prose"
            style={{ backgroundColor: replyBg, borderLeftColor: replyBorder }}
        >
            <div
                className="text-xs mb-1 font-medium truncate"
                style={{ color: primaryTextColor }}
            >
                {senderName}
            </div>
            {message.replied_msg_type === MESSAGE_TYPES.INTERACTIVE ? (
                <RenderHelloInteractiveMessage message={{ messageJson: message.replied_msg_content }} />
            ) :
                message.replied_msg_type === MESSAGE_TYPES.ATTACHMENT || message.replied_msg_type === MESSAGE_TYPES.TEXT_ATTACHMENT ? (
                    <RenderHelloAttachmentMessage message={{ messageJson: message.replied_msg_content }} isBot={message.replied_msg_sender_id || false} />
                ) : message.replied_msg_type === MESSAGE_TYPES.VIDEO_CALL ? (<RenderHelloVedioCallMessage message={{ messageJson: message.replied_msg_content }} />)
                    : (
                        <div className="text-sm text-gray-700">
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
    );
}

export default React.memo(addUrlDataHoc(RepliedMessage, []));