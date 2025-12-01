import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import MessageTime from './MessageTime';
import { linkify } from '@/utils/utilities';

interface BotCallMessageProps {
    message: {
        content: {
            text: string | any[];
        };
    };
}

function BotCallMessage({ message }: BotCallMessageProps) {
    const [showSenderTime, setShowSenderTime] = useState(false);
    const contentItems = useMemo(() => {
        let content = message?.content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch (e) {
                // If parsing fails, treat it as a single text item
                return [{ type: 'text', content: content }];
            }
        }
        return Array.isArray(content) ? content : [content];
    }, [message?.content]);

    return (
        <div className="mb-2 w-full flex flex-col items-start" onClick={() => setShowSenderTime(!showSenderTime)}>
            <div className="flex flex-col gap-2 w-fit max-w-[90%] message-card-backround whitespace-pre-wrap">
                {contentItems.map((item: any, index: number) => {
                    switch (item.type) {
                        case 'text':
                            return (
                                <div className="prose max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: linkify(item?.content) }}></div>
                                </div>
                            );
                        case 'attachment':
                            return (
                                <div key={index} className="rounded-lg overflow-hidden shadow-sm">
                                    {/* Using standard img for flexibility with unknown dimensions, or could use Next.js Image with fill/sizes */}
                                    <img
                                        src={item.content}
                                        alt="Attachment"
                                        className="max-w-full h-auto object-cover"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>
                            );
                        case 'button':
                            return (
                                <div key={index} className="flex flex-wrap gap-2">
                                    {item.options?.map((option: any, optIndex: number) => (
                                        <button
                                            key={optIndex}
                                            className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
                                            onClick={() => {
                                                // Handle button click if needed, maybe emit an event or send a message
                                                console.log('Button clicked:', option.title);
                                            }}
                                        >
                                            {option.title}
                                        </button>
                                    ))}
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
            </div>
            <div className={`transition-all duration-300 ease-in-out ${showSenderTime ? 'opacity-100 max-h-12' : 'opacity-0 max-h-0'}`}>
                <MessageTime message={message} tooltipPosition="tooltip-left" />
            </div>
        </div>
    );
}

export default React.memo(BotCallMessage);