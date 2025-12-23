import RenderHelloAttachmentMessage from "@/components/Hello/RenderHelloAttachmentMessage";
import RenderHelloInteractiveMessage from "@/components/Hello/RenderHelloInteractiveMessage";
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { $ReduxCoreType } from "@/types/reduxCore";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import React from "react";
import { MESSAGE_TYPES } from "./MessageType";

const RepliedMessage = ({ chatSessionId, message }: { chatSessionId: string; message: any }) => {

    const { agent_teams } = useCustomSelector((state: $ReduxCoreType) => ({
        agent_teams: state.Hello?.[chatSessionId]?.agent_teams || {},
    }))

    if (message?.replied_msg_type !== 'interactive' &&
        !message?.replied_msg_content?.text &&
        !(message?.replied_msg_content?.attachment && message?.replied_msg_content?.attachment?.length > 0)) {
        return null;
    }

    const senderId = message?.replied_msg_sender_id;
    const fromName = message?.replied_from_name;
    const senderName = fromName ? getSenderNameFromName(fromName) : (typeof senderId === 'string'
        ? getSenderNameFromId(senderId)
        : agent_teams?.agents?.[senderId] || 'You');

    function getSenderNameFromId(id: string) {
        switch (id?.toLowerCase()) {
            case "user":
                return "You";
            case "workflow":
                return "Bot";
            case "auto response":
                return "Bot";
            default:
                return id?.charAt(0).toUpperCase() + id?.slice(1);
        }
    }

    function getSenderNameFromName(name: string) {
        switch (name?.toLowerCase()) {
            case "user":
                return "You";
            case "workflow":
                return "Bot";
            case "auto response":
                return "Bot";
            default:
                return name;
        }
    }

    return (
        <div className={`mb-1 p-2 rounded-md border-l-2 border-blue-400 not-prose ${message?.role !== 'user' ? 'bg-gray-200 dark:bg-gray-800' : 'bg-black bg-opacity-10 border-white'}`}>
            <div className={`text-xs text-gray-600 mb-1 font-medium ${message?.role !== 'user' ? 'dark:text-gray-200' : 'text-inherit'}`}>{senderName}</div>
            {message.replied_msg_type === MESSAGE_TYPES.INTERACTIVE ? (
                <RenderHelloInteractiveMessage message={{ messageJson: message.replied_msg_content }} />
            ) :
                message.replied_msg_type === MESSAGE_TYPES.ATTACHMENT || message.replied_msg_type === MESSAGE_TYPES.TEXT_ATTACHMENT ? (
                    <RenderHelloAttachmentMessage message={{ messageJson: message.replied_msg_content }} />
                ) : (
                    <div className={`text-sm text-gray-700 ${message?.role !== 'user' ? 'dark:text-gray-200' : 'text-inherit'}`} dangerouslySetInnerHTML={{
                        __html: (() => {
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
                        })()
                    }}></div>
                )}
        </div>
    );
}

export default React.memo(addUrlDataHoc(RepliedMessage, []));