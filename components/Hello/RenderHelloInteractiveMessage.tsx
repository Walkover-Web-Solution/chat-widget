import { linkify } from '@/utils/utilities';
import { ExternalLink } from 'lucide-react';
import { useColor } from '../Chatbot/hooks/useColor';
import { useSendMessageToHello } from '../Chatbot/hooks/useHelloIntegration';
import ImageWithFallback from '../Interface-Chatbot/Messages/ImageWithFallback';

function RenderHelloInteractiveMessage({ message }: { message: any }) {
  const messageJson = message?.messageJson || {};
  const sendMessageToHello = useSendMessageToHello({});
  const { textColor, backgroundColor } = useColor();

  const renderHeader = (header: any) => {
    if (header?.type === "text") {
      return <div className="font-semibold mb-2">{header?.text}</div>;
    } else if (header?.type === 'video') {
      return (
        <div className="mb-1 rounded-lg overflow-hidden shadow-sm">
          <ImageWithFallback src={header?.video?.link} alt="header" />
        </div>
      );
    } else if (header?.type === "image") {
      return (
        <div className="mb-1 rounded-lg overflow-hidden shadow-sm">
          <ImageWithFallback src={header?.image?.link} alt="header" />
        </div>
      );
    } else if (header?.type === "document") {
      return (
        <div className="mb-1 rounded-lg overflow-hidden shadow-sm">
          <ImageWithFallback src={header?.document?.link} alt="header" />
        </div>
      );
    }
    return null;
  };

  const renderInteractiveContent = () => {
    const type = messageJson.type || message.message_type;
    switch (type) {
      case 'button':
        return (
          <div className="flex flex-col gap-2">
            {messageJson.header && renderHeader(messageJson.header)}

            {messageJson.body?.text && (
              <div className="mb-1">
                <div dangerouslySetInnerHTML={{ __html: linkify(messageJson?.body?.text) }}></div>
              </div>
            )}

            {messageJson.footer?.text && (
              <div className="text-xs text-gray-800 mb-1">
                <div dangerouslySetInnerHTML={{ __html: linkify(messageJson?.footer?.text) }}></div>
              </div>
            )}

            {messageJson.action?.buttons && (
              <div className="flex flex-col gap-2 mt-1 w-fit min-w-40">
                {messageJson.action.buttons.map((button: any, index: number) => (
                  <button
                    key={index}
                    className="btn btn-sm btn-outline w-full max-w-md rounded-md normal-case justify-start px-4 font-medium text-inherit border-current"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendMessageToHello?.(button?.reply?.title)
                    }}
                  >
                    {button.reply?.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'cta_url':
        const { header, body, footer, action } = messageJson ?? {};

        const hasHeader = Boolean(header);
        const hasBody = Boolean(body?.text);
        const hasFooter = Boolean(footer?.text);
        const hasAction = Boolean(action?.parameters?.url);

        return (
          <article className="space-y-4 shadow-sm">
            {/* Header (optional) */}
            {hasHeader && renderHeader(header)}

            {/* Body */}
            {hasBody && (
              <section
                className="prose max-w-none text-gray-800 text-sm"
                dangerouslySetInnerHTML={{ __html: linkify(body.text) }}
              />
            )}

            {/* Footer (optional) */}
            {hasFooter && (
              <footer
                className="text-xs text-gray-500"
                dangerouslySetInnerHTML={{ __html: linkify(footer.text) }}
              />
            )}

            {/* CTA button */}
            {hasAction && (
              <div className="pt-2">
                <a
                  href={action.parameters.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg  px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: backgroundColor, color: textColor }}
                >
                  <ExternalLink size={16} strokeWidth={2} />
                  {action.parameters.display_text || "View"}
                </a>
              </div>
            )}
          </article>
        );

      case 'list':
        return (
          <div className="flex flex-col gap-1 min-w-64">
            {messageJson?.header && renderHeader(messageJson?.header)}
            {messageJson?.body?.text && (
              <div className="mb-1 px-1">
                <div
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: linkify(messageJson?.body?.text) }}
                ></div>
              </div>
            )}

            {messageJson?.action?.sections && (
              <div className="overflow-hidden">
                {messageJson?.action?.sections?.map((section: any, sectionIndex: number) => (
                  <div key={sectionIndex} className='mb-2'>
                    {section?.title && (
                      <div className="pt-2 px-1 font-semibold text-base mb-1">
                        {section?.title}
                      </div>
                    )}
                    <ul className="menu menu-sm w-fit min-w-40 p-0 gap-2">
                      {section?.rows?.map((row: any, rowIndex: number) => (
                        <li key={row?.id || rowIndex} className='border border-gray-500 dark:border-inherit rounded-lg'>
                          <a
                            className="py-2"
                            onClick={() => sendMessageToHello?.(row?.title)}
                          >
                            <div className="flex flex-col w-full items-start">
                              <div className="font-medium break-words w-full text-inherit">{row?.title}</div>
                              {row?.description && (
                                <div className="text-xs text-gray-500 mt-1 w-full">
                                  <div className="break-words" dangerouslySetInnerHTML={{ __html: linkify(row?.description) }}></div>
                                </div>
                              )}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {messageJson?.footer?.text && (
              <div className="text-xs text-gray-800 mt-2 italic">
                <div dangerouslySetInnerHTML={{ __html: linkify(messageJson?.footer?.text) }}></div>
              </div>
            )}
          </div>
        );

      case 'carousel':
        return (
          <CarouselMessage
            messageJson={messageJson}
            backgroundColor={backgroundColor}
            textColor={textColor}
            sendMessageToHello={sendMessageToHello}
            renderHeader={renderHeader}
          />
        );

      default:
        return <div className="p-3 bg-gray-800 rounded-md">Unsupported Message Type</div>;
    }
  };

  return (
    <div className="interactive-message">
      {renderInteractiveContent()}
    </div>
  );
}

function CarouselMessage({ messageJson, backgroundColor, textColor, sendMessageToHello, renderHeader }: any) {
  return (
    <div className="flex flex-col gap-2 max-w-[320px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px]">
      {messageJson.body?.text && (
        <div className="mb-2 px-1">
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{ __html: linkify(messageJson.body.text) }}
          ></div>
        </div>
      )}

      <div className="carousel rounded-box w-full max-w-fit overflow-x-auto gap-3 py-2 px-1">
        {messageJson.action?.cards?.map((card: any, index: number) => {
          return (
            <div key={index} className="carousel-item relative w-56 flex-col border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl shadow-sm h-auto overflow-hidden flex-shrink-0 p-4">
              {card.header && renderHeader(card.header)}

              <div className="flex flex-col flex-grow">
                {card.body?.text && (
                  <div className="text-sm text-gray-800 dark:text-gray-200 mb-4 whitespace-pre-wrap">
                    <div dangerouslySetInnerHTML={{ __html: linkify(card.body.text) }}></div>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-auto pb-1 z-10 w-full min-h-min">
                  {card.action?.name === 'cta_url' && card.action?.parameters?.url && (
                    <a
                      href={card.action?.parameters?.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm rounded-md normal-case font-medium flex items-center justify-center gap-2"
                      style={{ backgroundColor, color: textColor, border: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={14} />
                      {card.action?.parameters?.display_text || "View"}
                    </a>
                  )}

                  {card.action?.buttons && card.action.buttons.map((button: any, bIndex: number) => (
                    <button
                      key={bIndex}
                      className="btn btn-sm btn-outline rounded-md normal-case px-4 font-medium border-current"
                      onClick={(e) => {
                        e.stopPropagation();
                        const title = button?.quick_reply?.title || button?.reply?.title || button?.title;
                        if (title) sendMessageToHello?.(title);
                      }}
                    >
                      {button?.quick_reply?.title || button?.reply?.title || button?.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {messageJson.footer?.text && (
        <div className="text-xs text-gray-500 mt-1 px-1 italic">
          <div dangerouslySetInnerHTML={{ __html: linkify(messageJson.footer.text) }}></div>
        </div>
      )}
    </div>
  );
}

export default RenderHelloInteractiveMessage;