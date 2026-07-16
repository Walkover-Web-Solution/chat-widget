import { ChatContext } from '@/components/Chatbot-Wrapper/ChatbotWrapper';
import { useReplyContext } from '@/components/Interface-Chatbot/contexts/ReplyContext';
import { MessageContext } from '@/components/Interface-Chatbot/InterfaceChatbot';
import { MESSAGE_TYPES } from '@/components/Interface-Chatbot/Messages/MessageType';
import { getAllChannels, getHelloChatHistoryApi, sendLocationToHelloApi, sendMessageToHelloApi } from '@/config/helloApi';
import socketManager from '@/hooks/socketManager';
import { store } from '@/store';
import { setDataInAppInfoReducer } from '@/store/appInfo/appInfoSlice';
import { setData, setHelloEventMessage, setImages, setInitialMessages, setOpenHelloForm, setPaginateMessages } from '@/store/chat/chatSlice';
import { setChannelListData, setHelloClientInfo, setHelloKeysData } from '@/store/hello/helloSlice';
import { useAppDispatch } from '@/store/useTypedHooks';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { emitEventToParent } from '@/utils/emitEventsToParent/emitEventsToParent';
import { PAGE_SIZE } from '@/utils/enums';
import { generateChannelId, generateNewId } from '@/utils/utilities';
import { useCallback, useContext, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useChatActions } from './useChatActions';
import { useReduxStateManagement } from './useReduxManagement';

interface HelloMessage {
  role: string;
  message_id?: string;
  from_name?: string;
  content: string;
  id?: string;
  chat_id?: string;
  urls?: string[];
  channel?: string;
  replied_msg_id?: string;
  replied_msg_content?: any;
  replied_msg_type?: string;
  replied_msg_sender_id?: string | null;
  replied_from_name?: string | null;
}

export const useHelloContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useHelloContext must be used within a HelloContextProvider');
  }
  return context;
};

// Individual Hello hooks
export const useHelloMessages = () => {
  const globalDispatch = useAppDispatch();

  const setHelloMessages = useCallback((messages: HelloMessage[]) => {
    globalDispatch(setInitialMessages({ messages, subThreadId: messages?.[0]?.channel || "" }));
  }, [globalDispatch]);

  const addHelloMessage = useCallback((message: HelloMessage | HelloMessage[] | any, subThreadId?: string) => {
    if (Array.isArray(message)) {
      globalDispatch(setPaginateMessages({ messages: message }));
      return;
    }
    globalDispatch(setHelloEventMessage({ message, subThreadId }));
  }, [globalDispatch]);

  return { setHelloMessages, addHelloMessage };
};

export const useFetchHelloPreviousHistory = () => {
  const { chatSessionId } = useHelloContext();
  const globalDispatch = useAppDispatch();
  const { setChatsLoading } = useChatActions();
  const { setHelloMessages } = useHelloMessages();

  const { uuid, currentChannelId } = useReduxStateManagement({
    chatSessionId,
    tabSessionId: useHelloContext().tabSessionId
  });

  return useCallback((dynamicChannelId?: string) => {
    const channelId = dynamicChannelId || currentChannelId;
    if (!channelId || !uuid) return;

    setChatsLoading(true);
    getHelloChatHistoryApi(channelId)
      .then((response) => {
        const helloChats = response?.data?.data;
        if (Array.isArray(helloChats) && helloChats.length > 0) {
          setHelloMessages(helloChats);
          globalDispatch(setData({
            hasMoreMessages: helloChats.length >= PAGE_SIZE.hello,
            skip: helloChats.length,
          }));
        } else {
          globalDispatch(setData({
            hasMoreMessages: false,
          }));
        }
      })
      .catch((error) => {
        console.error("Error fetching Hello chat history:", error);
      })
      .finally(() => {
        setChatsLoading(false);
      });
  }, [currentChannelId, uuid, setChatsLoading, setHelloMessages, globalDispatch]);
};

export const useGetMoreHelloChats = () => {
  const { chatSessionId } = useHelloContext();
  const globalDispatch = useAppDispatch();
  const { setChatsLoading } = useChatActions();
  const { addHelloMessage } = useHelloMessages();

  const { uuid, currentChannelId } = useReduxStateManagement({
    chatSessionId,
    tabSessionId: useHelloContext().tabSessionId
  });

  const { hasMoreMessages, skip } = useCustomSelector((state) => ({
    hasMoreMessages: state.Chat.hasMoreMessages,
    skip: state.Chat.skip
  }));

  return useCallback(() => {
    if (!currentChannelId || !uuid || !hasMoreMessages) return;

    setChatsLoading(true);
    getHelloChatHistoryApi(currentChannelId, skip)
      .then((response) => {
        const helloChats = response?.data?.data;
        if (Array.isArray(helloChats) && helloChats.length > 0) {
          addHelloMessage(helloChats);
          globalDispatch(setData({
            hasMoreMessages: helloChats.length >= PAGE_SIZE.hello,
            skip: skip + helloChats.length,
          }));
        } else {
          globalDispatch(setData({
            hasMoreMessages: false,
          }));
        }
      })
      .catch((error) => {
        console.error("Error fetching more Hello chat history:", error);
      })
      .finally(() => {
        setChatsLoading(false);
      });
  }, [currentChannelId, uuid, setChatsLoading, addHelloMessage, hasMoreMessages, skip, globalDispatch]);
};

const MAX_HISTORY_PAGES_TO_SEARCH = 50;

function findRepliedMessageElement(repliedMsgId: string): HTMLElement | null {
  const byId = document.getElementById(`msg-${repliedMsgId}`);
  if (byId) return byId;
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return document.querySelector<HTMLElement>(`[data-msg-ids~="${CSS.escape(String(repliedMsgId))}"]`);
  }
  return null;
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Locates the message a reply-quote points to (by its persisted
 * replied_msg_id) and scrolls to it. If the target isn't currently rendered
 * (older messages not paginated in yet), it progressively fetches older
 * history pages -- same API/actions as useGetMoreHelloChats -- until the
 * message is found or history is exhausted.
 */
export const useScrollToRepliedMessage = () => {
  const { chatSessionId, tabSessionId } = useHelloContext();
  const { uuid, currentChannelId } = useReduxStateManagement({ chatSessionId, tabSessionId });

  return useCallback(async (repliedMsgId: string): Promise<boolean> => {
    let target = findRepliedMessageElement(repliedMsgId);
    let attempts = 0;

    while (!target && attempts < MAX_HISTORY_PAGES_TO_SEARCH) {
      const state = store.getState();
      const hasMoreMessages = state.Chat?.hasMoreMessages;
      const skip = state.Chat?.skip ?? 0;

      if (!hasMoreMessages || !currentChannelId || !uuid) break;

      attempts++;
      try {
        const response = await getHelloChatHistoryApi(currentChannelId, skip);
        const helloChats = response?.data?.data;
        if (Array.isArray(helloChats) && helloChats.length > 0) {
          store.dispatch(setPaginateMessages({ messages: helloChats }));
          store.dispatch(setData({
            hasMoreMessages: helloChats.length >= PAGE_SIZE.hello,
            skip: skip + helloChats.length,
          }));
        } else {
          store.dispatch(setData({ hasMoreMessages: false }));
          break;
        }
      } catch (error) {
        console.error("[useScrollToRepliedMessage] failed to fetch older messages:", error);
        break;
      }

      await waitForNextFrame();
      target = findRepliedMessageElement(repliedMsgId);
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('replied-msg-highlight');
      setTimeout(() => target?.classList.remove('replied-msg-highlight'), 1500);
      return true;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[useScrollToRepliedMessage] could not locate message id="${repliedMsgId}" even after exhausting available history.`);
    }
    return false;
  }, [currentChannelId, uuid]);
};

export const useFetchChannels = () => {
  const dispatch = useDispatch();

  return useCallback(() => {
    return getAllChannels()
      .then(data => {
        dispatch(setChannelListData(data));
        if (data?.customer_name && data?.customer_mail && data?.customer_number) {
          dispatch(setHelloKeysData({ showWidgetForm: false }))
        } else {
          dispatch(setHelloKeysData({ showWidgetForm: true }))
        }
        dispatch(setHelloClientInfo({ clientInfo: { Name: data?.customer_name, Email: data?.customer_mail, Phonenumber: data?.customer_number } }));
        return data;
      })
      .catch(error => {
        console.error("Error fetching channels:", error);
      });
  }, [dispatch]);
};

export const useHelloTimeout = () => {
  const { setLoading } = useChatActions();
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const startTimeoutTimer = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    timeoutIdRef.current = setTimeout(() => {
      setLoading(false);
    }, 10000); // 10 seconds timeout

    return () => {
      if (timeoutIdRef.current) {
        setLoading(false);
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [setLoading]);

  return { startTimeoutTimer };
};

export const useOnSendHello = () => {
  const { chatSessionId, tabSessionId } = useHelloContext();
  const globalDispatch = useAppDispatch();
  const dispatch = useDispatch();
  const { setLoading } = useChatActions();
  const { addHelloMessage } = useHelloMessages();
  const { startTimeoutTimer } = useHelloTimeout();
  const fetchChannels = useFetchChannels();
  const { replyToMessage } = useReplyContext();
  const {
    uuid,
    unique_id,
    presence_channel,
    currentChatId,
    currentTeamId,
    currentChannelId,
    overrideChannelId
  } = useReduxStateManagement({
    chatSessionId,
    tabSessionId
  });

  const { assigned_type, showWidgetForm, images, helloVariables, companyId, demo_widget } = useCustomSelector((state) => ({
    assigned_type: state.Hello?.[chatSessionId]?.channelListData?.channels?.find(
      (channel: any) => channel?.channel === currentChannelId
    )?.assigned_type,
    showWidgetForm: state.Hello?.[chatSessionId]?.showWidgetForm,
    images: state.Chat.images,
    helloVariables: state.draftData?.hello?.variables || {},
    companyId: state.Hello?.[chatSessionId]?.widgetInfo?.company_id || '',
    demo_widget: state.Hello?.[chatSessionId]?.widgetInfo?.demo_widget || false
  }));

  const isBot = assigned_type === 'bot';

  return useCallback(async (message?: string, newMessage?: HelloMessage | string, voiceCall?: boolean, newChannelId?: string, overrideChatId?: string, overrideTeamId?: string, repliedOn?: string) => {
    if (!voiceCall && (!message?.trim() && (!images || images.length === 0))) return;

    try {

      const channelIdToUse = newChannelId || currentChannelId || overrideChannelId;
      const chatIdToUse = overrideChatId || currentChatId;
      const teamIdToUse = overrideTeamId || currentTeamId;

      let workingChannelId = channelIdToUse;
      if (!chatIdToUse && !channelIdToUse) {
        workingChannelId = generateChannelId(companyId);
        dispatch(setDataInAppInfoReducer({
          subThreadId: workingChannelId
        }));
      }
      if (newMessage) {
        const getMessageContent = (content: string | { text: string }): string => {
          if (typeof content === 'string') return content;
          return content?.text || '';
        };
        const messageWithReply = typeof newMessage === 'object' ? {
          ...newMessage,
          replied_msg_content: replyToMessage ? (replyToMessage?.messageJson?.category ? {
            ...replyToMessage?.messageJson,
            text: replyToMessage?.content,
            attachment: replyToMessage?.urls || []
          } : {
            text: getMessageContent(replyToMessage?.content),
            attachment: replyToMessage?.urls || []
          }) : (newMessage as any).replied_msg_content,
          replied_msg_type: replyToMessage ? (replyToMessage?.urls?.length ? MESSAGE_TYPES.ATTACHMENT : replyToMessage?.messageJson?.category ? MESSAGE_TYPES.INTERACTIVE : undefined) : (newMessage as any).replied_msg_type,
          replied_msg_sender_id: replyToMessage ? (replyToMessage.is_auto_response || !replyToMessage.from_name ? 'bot' : replyToMessage.sender_id || replyToMessage.from_name) : null,
          replied_from_name: replyToMessage ? replyToMessage.from_name : null,
          replied_msg_id: replyToMessage ? (replyToMessage.message_id || replyToMessage.id) : (newMessage as any).replied_msg_id,
        } : newMessage;
        addHelloMessage(messageWithReply, workingChannelId);
      }
      const channelDetail = (!chatIdToUse || demo_widget) ? {
        call_enabled: null,
        uuid,
        unique_id,
        country: null,
        pseudo_name: null,
        presence_channel,
        country_iso2: null,
        chatInputSubmitted: false,
        is_blocked: null,
        customer_name: null,
        customer_number: null,
        customer_mail: null,
        team_id: teamIdToUse,
        new: true,
        channel_hex: workingChannelId || undefined
      } : undefined;
      let attachments;
      if (!voiceCall) {
        // Show widget form only if in case of new chat and showWidgetForm is true
        if (!chatIdToUse && showWidgetForm) {
          globalDispatch(setOpenHelloForm(true));
          setLoading(true);
        }

        attachments = Array.isArray(images) && images?.length ? images : null;

        if (attachments) {
          globalDispatch(setImages([]));
        }

        if ((isBot || !assigned_type)) {
          setLoading(true);
        }

        startTimeoutTimer();
      }

      if (demo_widget && channelIdToUse) {
        await socketManager.subscribe([channelIdToUse]);
      }
      let widget_msg_id: string | undefined;
      if (newMessage && typeof newMessage === 'object' && 'id' in newMessage) {
        widget_msg_id = newMessage.id;
      }
      const data = await sendMessageToHelloApi(message, attachments, channelDetail, chatIdToUse, helloVariables, voiceCall, demo_widget, widget_msg_id, repliedOn);
      if (data && (!chatIdToUse || !channelIdToUse || demo_widget)) {
        dispatch(setDataInAppInfoReducer({
          subThreadId: data?.['channel'],
          currentChatId: data?.['id'],
          currentChannelId: data?.['channel'],
          overrideChannelId: ""
        }));
        // no need to append user message again this time
        // addHelloMessage(newMessage, data?.['channel']);
        if (!demo_widget) {
          const response = await fetchChannels();
          if (response?.channels?.length === 1 && response?.channels?.[0]?.id !== null) {
            emitEventToParent('HIDE_STARTER_QUESTION')
          }
        }
        if (data?.['channel']) {
          try {
            if (demo_widget) {
              await socketManager.subscribe([data?.['channel']]);
            } else {
              await socketManager.subscribe([data?.['presence_channel'], data?.['channel']]);
            }
          } catch (error) {
            console.error("Failed to subscribe to channels:", error);
          }
        }
      }
      return data;
    } catch (error) {
      if (isBot) {
        setLoading(false);
      }
      dispatch(setDataInAppInfoReducer({
        overrideChannelId: ""
      }));
      console.error("Error sending message to Hello:", error);
    }
  }, [
    currentChatId,
    currentTeamId,
    uuid,
    unique_id,
    presence_channel,
    globalDispatch,
    images,
    isBot,
    startTimeoutTimer,
    setLoading,
    dispatch,
    fetchChannels,
    currentChannelId,
    showWidgetForm,
    assigned_type,
    addHelloMessage,
    helloVariables,
    companyId,
    demo_widget,
    replyToMessage,
    overrideChannelId
  ]);
};

export const useSendLocationToHello = () => {
  const { chatSessionId, tabSessionId } = useHelloContext();
  const { setNewMessage } = useChatActions();
  const { addHelloMessage } = useHelloMessages();
  const { setLoading } = useChatActions();
  const { startTimeoutTimer } = useHelloTimeout();

  const { currentChatId, currentChannelId } = useReduxStateManagement({
    chatSessionId,
    tabSessionId
  });

  const { helloVariables, demo_widget, assigned_type } = useCustomSelector((state) => ({
    helloVariables: state.draftData?.hello?.variables || {},
    demo_widget: state.Hello?.[chatSessionId]?.widgetInfo?.demo_widget || false,
    assigned_type: state.Hello?.[chatSessionId]?.channelListData?.channels?.find(
      (channel: any) => channel?.channel === currentChannelId
    )?.assigned_type,
  }));

  return useCallback(async (latitude: number, longitude: number) => {
    const messageId = generateNewId(24);
    const newMessage = {
      id: messageId,
      role: "user",
      chat_id: currentChatId || generateNewId(),
      message_type: "location",
      content: {
        latitude,
        longitude,
      },
      timetoken: Date.now(),
      sender_id: "user",
    };

    addHelloMessage(newMessage, currentChannelId);

    if (assigned_type === 'bot' || !assigned_type) {
      setLoading(true);
    }
    startTimeoutTimer();

    await sendLocationToHelloApi(
      latitude,
      longitude,
      undefined,
      currentChatId,
      helloVariables,
      demo_widget,
      messageId
    );

    setNewMessage(true);
  }, [currentChatId, currentChannelId, addHelloMessage, setNewMessage, setLoading, helloVariables, demo_widget, assigned_type, startTimeoutTimer]);
};

export const useSendMessageToHello = ({
  messageRef: propMessageRef,
  replyToMessageId,
  replied_msg_type,
  replied_msg_content,
}: {
  messageRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  replyToMessageId?: string,
  replied_msg_type?: string,
  replied_msg_content?: any,
}) => {
  const context = useContext(MessageContext);
  const messageRef = propMessageRef ?? context.messageRef;
  const { chatSessionId } = useHelloContext();
  const { setNewMessage } = useChatActions();
  const { addHelloMessage } = useHelloMessages();
  const onSendHello = useOnSendHello();

  const { currentChatId, currentChannelId } = useReduxStateManagement({
    chatSessionId,
    tabSessionId: useHelloContext().tabSessionId
  });

  const { images } = useCustomSelector((state) => ({
    images: state.Chat.images,
  }));

  return useCallback((message: string = '') => {
    // Handle different types of input elements
    let textMessage = '';
    if (messageRef?.current) {
      if ('value' in messageRef.current) {
        textMessage = messageRef.current.value || message || '';
      } else if (messageRef.current instanceof HTMLDivElement) {
        textMessage = messageRef.current.textContent || message || '';
      }
    } else {
      textMessage = message || '';
    }
    if (!textMessage.trim() && (!images || images?.length === 0)) return false;

    const messageId = generateNewId(24);
    const newMessage = {
      id: messageId,
      role: "user",
      chat_id: currentChatId || generateNewId(),
      content: {
        text: textMessage,
        attachment: images || []
      },
      timetoken: Date.now(),
      sender_id: "user",
      ...(replied_msg_type ? { replied_msg_type } : {}),
      ...(replied_msg_content !== undefined ? { replied_msg_content } : {}),
      ...(replyToMessageId ? { replied_msg_id: replyToMessageId } : {}),
    };

    // Always add message to chat so user can see it immediately
    // addHelloMessage(newMessage, channelIdToUse);

    // Send message to API
    onSendHello(textMessage, newMessage, false, undefined, undefined, undefined, replyToMessageId);
    setNewMessage(true);

    // Clear input field
    if (messageRef?.current) {
      if ('value' in messageRef.current) {
        messageRef.current.value = '';
      } else if (messageRef.current instanceof HTMLDivElement) {
        messageRef.current.textContent = '';
      }
    }

    return true;
  }, [onSendHello, addHelloMessage, images, messageRef, currentChannelId, currentChatId, setNewMessage, replyToMessageId, replied_msg_type, replied_msg_content]);
};