import { LinearProgress } from '@mui/material';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef } from 'react';

// Context and hooks
import { MessageContext } from '../Interface-Chatbot/InterfaceChatbot';
import { useReduxStateManagement } from './hooks/useReduxManagement';
import useRtlayerEventManager from './hooks/useRtlayerEventManager';

// Components
import FormComponent from '../FormComponent';
import CallUI from '../Hello/callUI';
import ChatbotDrawer from '../Interface-Chatbot/ChatbotDrawer';
import ChatbotHeader from '../Interface-Chatbot/ChatbotHeader';
import ChatbotHeaderTab from '../Interface-Chatbot/ChatbotHeaderTab';
import ChatbotTextField from '../Interface-Chatbot/ChatbotTextField';
import MessageList from '../Interface-Chatbot/Messages/MessageList';
import NotificationPage from '../Interface-Chatbot/NotificationPage';
import StarterQuestions from '../Interface-Chatbot/Messages/StarterQuestions';

// Utils
import { ChatBotGif } from '@/assests/assestsIndex';
import { addUrlDataHoc } from '@/hoc/addUrlDataHoc';
import { setToggleDrawer } from '@/store/chat/chatSlice';
import { useAppDispatch } from '@/store/useTypedHooks';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { useChatEffects } from './hooks/useChatEffects';
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

// Memoized components
const EmptyChatView = React.memo(() => (
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
    <StarterQuestions />
  </div>
));

const ActiveChatView = React.memo(({ isSmallScreen }: { isSmallScreen: boolean }) => (
  <div className="flex flex-col flex-1 overflow-hidden">
    <div className="w-full h-full overflow-hidden relative flex-1">
      <MessageList />
    </div>
    <div
      className={"max-w-5xl mx-auto p-3 pb-3 w-full" + (isSmallScreen ? ' border-t border-gray-100' : "") }
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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const { primaryBgColor } = useColor();
  const { isSmallScreen } = useScreenSize();
  const dispatch = useAppDispatch();

  // State management
  const { show_widget_form, isToggledrawer, chatsLoading, subThreadId, showNotificationView, notificationsCount } = useCustomSelector((state) => {
    const widgetInfo = state.Hello?.[chatSessionId]?.widgetInfo
    return ({
      show_widget_form: typeof widgetInfo?.show_widget_form === 'boolean' ? widgetInfo?.show_widget_form : state.Hello?.[chatSessionId]?.showWidgetForm,
      isToggledrawer: state.Chat.isToggledrawer,
      chatsLoading: state.Chat.chatsLoading,
      subThreadId: state.Chat.subThreadId,
      notificationsCount: (state.Chat.notifications || []).length,
      showNotificationView: state.appInfo?.[tabSessionId]?.showNotificationView || false,
    })
  });

  // Custom hooks
  useChatEffects({ chatSessionId, tabSessionId, messageRef, timeoutIdRef });
  useHelloEffects({ chatSessionId, tabSessionId, messageRef });
  useReduxEffects({ chatSessionId, tabSessionId });
  useRtlayerEventManager({ timeoutIdRef, chatSessionId, tabSessionId });

  const { isHelloUser, currentChatId, isDefaultNavigateToChatScreen } = useReduxStateManagement({ chatSessionId, tabSessionId });

  // Effect to open drawer for new human users
  useEffect(() => {
    if (isHelloUser && !currentChatId && !mountedRef.current) {
      dispatch(setToggleDrawer(true));
    }
    mountedRef.current = true;
  }, [isHelloUser, currentChatId, dispatch]);

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
  const contextValue = useMemo(() => ({
    messageRef,
    timeoutIdRef
  }), [
    messageRef,
    timeoutIdRef
  ]);

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
              {isHelloUser && show_widget_form && (
                <FormComponent />
              )}
              <CallUI />
              <ChatbotHeaderTab />
            </>
          )}

          {/* Main view routing:
              1. showNotificationView + notifications → NotificationPage (list of push notifications)
              2. subThreadId truthy → ActiveChatView (real channel OR notification-launched chat)
              3. else → EmptyChatView (new chat / idle state) */}
          {showNotificationView && notificationsCount > 0 ? (
            <NotificationPage />
          ) : subThreadId ? (
            // A thread is selected (real channel OR notification-launched chat) → active chat
            <ActiveChatView isSmallScreen={isSmallScreen} />
          ) : (
            // Fresh state, nothing selected → empty / new chat view
            <EmptyChatView />
          )}
        </div>
      </div>
    </MessageContext.Provider>
  );
}

// Export with HOC for URL data
export default React.memo(addUrlDataHoc(Chatbot));