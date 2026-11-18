import { LinearProgress } from '@mui/material';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef } from 'react';

// Context and hooks
import { MessageContext } from '../Interface-Chatbot/InterfaceChatbot';
import { useReduxStateManagement } from './hooks/useReduxManagement';

// Components
import FormComponent from '../FormComponent';
import CallUI from '../Hello/callUI';
import ChatbotDrawer from '../Interface-Chatbot/ChatbotDrawer';
import ChatbotHeader from '../Interface-Chatbot/ChatbotHeader';
import ChatbotTextField from '../Interface-Chatbot/ChatbotTextField';
import MessageList from '../Interface-Chatbot/Messages/MessageList';
import NotificationPage from '../Interface-Chatbot/NotificationPage';

// Utils
import { ChatBotGif } from '@/assests/assestsIndex';
import { addUrlDataHoc } from '@/hoc/addUrlDataHoc';
import { setToggleDrawer } from '@/store/chat/chatSlice';
import { setDataInDraftReducer } from '@/store/draftData/draftDataSlice';
import { useAppDispatch } from '@/store/useTypedHooks';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { useColor } from './hooks/useColor';
import { useHelloEffects } from './hooks/useHelloEffects';
import { useReduxEffects } from './hooks/useReduxEffects';
import { useScreenSize } from './hooks/useScreenSize';

/**
 * A component that displays a chatbot interface.
 * It includes a header, drawer, and message list.
 */

interface ChatbotProps {
  chatSessionId: string
  tabSessionId: string
}

const EmptyChatView = React.memo(() => {
  const dispatch = useAppDispatch();
  // openWithMessage > config.prefillMessage > ''
  const { eventPrefill, configPrefill } = useCustomSelector((state) => {
    const chatSessionId = state.draftData?.chatSessionId || '';
    return {
      eventPrefill: state.draftData?.prefillInputMessage || '',
      configPrefill: state.Hello?.[chatSessionId]?.helloConfig?.prefillMessage || '',
    };
  });

  useEffect(() => {
    const message = eventPrefill || configPrefill;
    if (message) dispatch(setDataInDraftReducer({ prefillInputMessage: message }));
  }, [configPrefill]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl mx-auto mt-[-84px] p-5">
      <div className="flex flex-col items-center w-full">
        <Image
          src={ChatBotGif}
          alt="Chatbot"
          className="block"
          width={100}
          height={100}
          priority
        />
        <h2 className="text-xl font-bold">
          What can I help with?
        </h2>
      </div>
      <div className="max-w-5xl w-full mt-8">
        <ChatbotTextField />
      </div>
    </div>
  );
});

const ActiveChatView = React.memo(({ isSmallScreen }: { isSmallScreen: boolean }) => (
  <div className="flex flex-col flex-1 overflow-hidden">
    <div className="w-full h-full overflow-hidden relative flex-1">
      <MessageList />
    </div>
    <div
      className={"max-w-5xl mx-auto p-3 pb-3 w-full" + (isSmallScreen ? ' border-t border-gray-100' : "")}
      style={{ backgroundColor: (isSmallScreen ? 'var(--background)' : undefined) }}
    >
      <ChatbotTextField />
    </div>
  </div>
));


function Chatbot({ chatSessionId, tabSessionId }: ChatbotProps) {
  // Refs
  const mountedRef = useRef<boolean>(false);
  const messageRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const { primaryBgColor } = useColor();
  const { isSmallScreen } = useScreenSize();
  const dispatch = useAppDispatch();

  // State management
  const { show_widget_form, greetingMessage, isToggledrawer, chatsLoading, subThreadId, showNotificationView, notificationsCount } = useCustomSelector((state) => {
    // script config wins, then runtime/API widgetInfo, then the client-details heuristic
    const show_widget_form = state.Hello?.[chatSessionId]?.helloConfig?.show_widget_form
      ?? state.Hello?.[chatSessionId]?.widgetInfo?.show_widget_form
    return ({
      show_widget_form: typeof show_widget_form === 'boolean' ? show_widget_form : state.Hello?.[chatSessionId]?.showWidgetForm,
      greetingMessage: state.Hello?.[chatSessionId]?.greeting as any,
      isToggledrawer: state.Chat.isToggledrawer,
      chatsLoading: state.Chat.chatsLoading,
      subThreadId: state.Chat.subThreadId,
      notificationsCount: (state.Chat.notifications || []).length,
      showNotificationView: state.appInfo?.[tabSessionId]?.showNotificationView || false,
    })
  });

  // Custom hooks
  useHelloEffects({ chatSessionId, tabSessionId, messageRef });
  useReduxEffects({ tabSessionId });

  const { currentChatId, isDefaultNavigateToChatScreen } = useReduxStateManagement({ chatSessionId, tabSessionId });

  // Effect to open drawer for new human users
  useEffect(() => {
    if (!currentChatId && !mountedRef.current) {
      dispatch(setToggleDrawer(true));
    }
    mountedRef.current = true;
  }, [currentChatId, dispatch]);

  // open Chat directly if no team or one team exista
  useEffect(() => {
    if (isDefaultNavigateToChatScreen) {
      dispatch(setToggleDrawer(false));
      if (messageRef.current) {
        messageRef.current.focus();
      }
    }
  }, [isDefaultNavigateToChatScreen])

  // Context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ messageRef }), [messageRef]);

  // Check if chat is empty
  const isChatEmpty = !subThreadId &&
    (!greetingMessage || (!greetingMessage.text && !greetingMessage?.options?.length));

  return (
    <MessageContext.Provider value={contextValue}>
      <div className="flex h-screen w-full overflow-hidden relative">
        {/* Sidebar - visible on large screens */}
        <div className={`border-r overflow-y-auto transition-all duration-300 ease-in-out ${isToggledrawer && !isSmallScreen ? 'w-96 max-w-[286px]' : 'w-0 absolute'}`}>
          <ChatbotDrawer
            setToggleDrawer={(data: boolean) => { dispatch(setToggleDrawer(data)) }}
            isToggledrawer={isToggledrawer}
          />
        </div>

        {/* Main content area */}
        <div className="flex flex-col w-full">
          {/* Mobile header */}
          <ChatbotHeader />

          {/* Loading indicator */}
          {chatsLoading && (
            <div className="w-full">
              <LinearProgress
                color="inherit"
                style={{ color: primaryBgColor }}
              />
            </div>
          )}

          {/* Form / Call / Tab overlays — hide when user is browsing notification list
              to prevent "Enter your details" form from covering notification content */}
          {!(showNotificationView && notificationsCount > 0) && (
            <>
              {show_widget_form && (
                <FormComponent />
              )}
              <CallUI />
            </>
          )}

          {showNotificationView && notificationsCount > 0 ? (
            <NotificationPage />
          ) : isChatEmpty ? (
            // Fresh state, nothing selected → empty / new chat view
            <EmptyChatView />
          ) : (
            // A thread is selected (real channel OR notification-launched chat) → active chat
            <ActiveChatView isSmallScreen={isSmallScreen} />
          )}
        </div>
      </div>
    </MessageContext.Provider>
  );
}

// Export with HOC for URL data
export default React.memo(addUrlDataHoc(Chatbot));