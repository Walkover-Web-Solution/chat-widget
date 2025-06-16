import { ThemeContext } from '@/components/AppWrapper';
import { ChatbotContext } from '@/components/context';
import { getAgentTeamApi, getAllChannels, getCallToken, getClientToken, getGreetingQuestions, getHelloChatHistoryApi, getJwtToken, initializeHelloChat, registerAnonymousUser, sendMessageToHelloApi } from '@/config/helloApi';
import useNotificationSocket from '@/hooks/notifications/notificationSocket';
import useNotificationSocketEventHandler from '@/hooks/notifications/notificationSocketEventHandler';
import useSocket from '@/hooks/socket';
import useSocketEvents from '@/hooks/socketEventHandler';
import socketManager from '@/hooks/socketManager';
import { setDataInAppInfoReducer } from '@/store/appInfo/appInfoSlice';
import { setData, setHelloEventMessage, setImages, setInitialMessages, setOpenHelloForm, setPaginateMessages } from '@/store/chat/chatSlice';
import { setAgentTeams, setChannelListData, setGreeting, setHelloKeysData, setJwtToken, setWidgetInfo } from '@/store/hello/helloSlice';
import { useAppDispatch } from '@/store/useTypedHooks';
import { $ReduxCoreType } from '@/types/reduxCore';
import { GetSessionStorageData } from '@/utils/ChatbotUtility';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { emitEventToParent } from '@/utils/emitEventsToParent/emitEventsToParent';
import { PAGE_SIZE } from '@/utils/enums';
import { generateNewId, getLocalStorage } from '@/utils/utilities';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import helloVoiceService from './HelloVoiceService';
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
}

interface UseHelloIntegrationProps {
  messageRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLDivElement>;
  chatSessionId: string;
  tabSessionId: string;
  chatActions: {
    setLoading: (data: boolean) => void
    setChatsLoading: (data: boolean) => void
    setNewMessage: (data: boolean) => void
  }
}

const useHelloIntegration = ({ chatSessionId, messageRef, chatActions, tabSessionId }: UseHelloIntegrationProps) => {
  const { handleThemeChange } = useContext(ThemeContext);
  const { isHelloUser } = useContext(ChatbotContext);
  const { loading, helloMessages, images, hasMoreMessages, skip } = useCustomSelector((state) => ({
    loading: state.Chat.loading,
    helloMessages: state.Chat.helloMessages,
    images: state.Chat.images,
    hasMoreMessages: state.Chat.hasMoreMessages,
    skip: state.Chat.skip
  }))
  const { setLoading, setChatsLoading, setNewMessage } = chatActions
  const globalDispatch = useAppDispatch();

  const {
    uuid,
    unique_id,
    presence_channel,
    currentChatId,
    currentTeamId,
    currentChannelId
  } = useReduxStateManagement({ chatSessionId, tabSessionId });

  const { assigned_type, companyId, botId, showWidgetForm, reduxChatSessionId } = useCustomSelector((state: $ReduxCoreType) => ({
    assigned_type: state.Hello?.[chatSessionId]?.channelListData?.channels?.find(
      (channel: any) => channel?.channel === currentChannelId
    )?.assigned_type,
    companyId: state.Hello?.[chatSessionId]?.widgetInfo?.company_id || '',
    botId: state.Hello?.[chatSessionId]?.widgetInfo?.bot_id || '',
    showWidgetForm: state.Hello?.[chatSessionId]?.showWidgetForm,
    reduxChatSessionId: state.tabInfo?.widgetToken
  }));

  const isBot = assigned_type === 'bot';
  const dispatch = useDispatch();
  const mountedRef = useRef(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useSocket({ chatSessionId });
  useNotificationSocket({ chatSessionId });

  const setHelloMessages = useCallback((messages: HelloMessage[]) => {
    globalDispatch(setInitialMessages({ messages, subThreadId: messages?.[0]?.channel || "" }));
  }, [globalDispatch]);

  const addHelloMessage = useCallback((message: HelloMessage, subThreadId?: string) => {
    if (Array.isArray(message)) {
      globalDispatch(setPaginateMessages({ messages: message }));
      return
    }
    globalDispatch(setHelloEventMessage({ message, subThreadId }));

  }, [globalDispatch]);


  useEffect(() => {
    if (isHelloUser && currentChannelId) {
      fetchHelloPreviousHistory()
    }
  }, [currentChannelId, isHelloUser])

  // Fetch previous Hello chat history
  const fetchHelloPreviousHistory = useCallback((dynamicChannelId?: string) => {
    const channelId = dynamicChannelId || currentChannelId;
    if (!channelId || !uuid) return;

    setChatsLoading(true);
    getHelloChatHistoryApi(channelId)
      .then((response) => {
        const helloChats = response?.data?.data;
        if (Array.isArray(helloChats) && helloChats.length > 0) {
          const chatsToStore = helloChats
          setHelloMessages(chatsToStore);
          globalDispatch(setData({
            hasMoreMessages: helloChats.length >= PAGE_SIZE.hello,
            skip: helloChats.length,
          }))
        } else {
          globalDispatch(setData({
            hasMoreMessages: false,
          }))
        }
      })
      .catch((error) => {
        console.error("Error fetching Hello chat history:", error);
      })
      .finally(() => {
        setChatsLoading(false);
      });
  }, [currentChannelId, uuid, setChatsLoading, setHelloMessages]);


  const getMoreHelloChats = useCallback(() => {
    if (!currentChannelId || !uuid) return;
    if (!hasMoreMessages) return;

    setChatsLoading(true);
    getHelloChatHistoryApi(currentChannelId, skip)
      .then((response) => {
        const helloChats = response?.data?.data;
        if (Array.isArray(helloChats) && helloChats.length > 0) {
          const chatsToStore = helloChats;
          addHelloMessage(chatsToStore);
          globalDispatch(setData({
            hasMoreMessages: helloChats.length >= PAGE_SIZE.hello,
            skip: skip + helloChats.length,
          }))
        } else {
          globalDispatch(setData({
            hasMoreMessages: false,
          }))
        }
      })
      .catch((error) => {
        console.error("Error fetching more Hello chat history:", error);
      })
      .finally(() => {
        setChatsLoading(false);
      });
  }, [currentChannelId, uuid, setChatsLoading, setHelloMessages, hasMoreMessages, skip]);

  // Fetch all channels
  const fetchChannels = useCallback(() => {
    return getAllChannels()
      .then(data => {
        dispatch(setChannelListData(data));
        if (data?.customer_name === null || data?.customer_number === null || data?.customer_mail === null) {
          dispatch(setHelloKeysData({ showWidgetForm: true }));
        }
        return data;
      })
      .catch(error => {
        console.error("Error fetching channels:", error);
      });
  }, [dispatch]);

  useSocketEvents({ messageRef, fetchChannels, chatSessionId, setLoading, tabSessionId });
  useNotificationSocketEventHandler({ chatSessionId })

  // Start timeout timer for response waiting
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

  // Send message to Hello
  const onSendHello = useCallback(async (message: string, newMessage: HelloMessage) => {
    if (!message.trim() && images.length === 0) return;

    try {
      const channelDetail = !currentChatId ? {
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
        team_id: currentTeamId,
        new: true,
      } : undefined;
      // show widget form only if in case of new chat and showWidgetForm is true i.e if all the fields are not filled
      if (!currentChatId && showWidgetForm) {
        globalDispatch(setOpenHelloForm(true));
      }

      const attachments = Array.isArray(images) && images?.length ? images : null;

      if (attachments) {
        globalDispatch(setImages([]));
      }

      if (isBot || !assigned_type) {
        setLoading(true);
      }

      startTimeoutTimer();

      const data = await sendMessageToHelloApi(message, attachments, channelDetail, currentChatId);
      if (data && (!currentChatId || !currentChannelId)) {
        dispatch(setDataInAppInfoReducer({
          subThreadId: data?.['channel'],
          currentChatId: data?.['id'],
          currentChannelId: data?.['channel']
        }));
        addHelloMessage(newMessage, data?.['channel'])
        fetchChannels();
        if (data?.['presence_channel'] && data?.['channel']) {
          try {
            await socketManager.subscribe([data?.['presence_channel'], data?.['channel']]);
          } catch (error) {
            console.error("Failed to subscribe to channels:", error);
          }
        }

      }
    } catch (error) {
      if (isBot) {
        setLoading(false);
      }
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
    showWidgetForm
  ]);

  const sendMessageToHello = useCallback((message: string = '') => {
    // Handle different types of input elements
    let textMessage = '';
    if (messageRef?.current) {
      if ('value' in messageRef.current) {
        textMessage = messageRef.current.value || message || '';
      } else if (messageRef.current instanceof HTMLDivElement) {
        textMessage = messageRef.current.textContent || message || '';
      }
    }

    if (!textMessage.trim() && images?.length === 0) return false;

    const messageId = generateNewId();
    const newMessage = {
      id: messageId,
      role: "user",
      chat_id: currentChatId || generateNewId(),
      content: {
        text: textMessage,
        attachment: images || []
      },
      timetoken: Date.now(),
      sender_id: "user"
    };

    // Add message to chat
    if (currentChannelId) addHelloMessage(newMessage);

    // Send message to API
    onSendHello(textMessage, newMessage);
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
  }, [onSendHello, addHelloMessage, images, messageRef, currentChannelId]);

  useEffect(() => {
    if (reduxChatSessionId) {
      const widgetToken = reduxChatSessionId?.split('_')[0] // Extract first part (e.g., "d1bc7")
      initializeHelloServices(widgetToken);
    }
  }, [reduxChatSessionId])

  const initializeHelloServices = async (widgetToken: string = '') => {
    // Prevent duplicate initialization
    if (!widgetToken || widgetToken !== getLocalStorage("WidgetId")) {
      return;
    }

    try {
      let a_clientId = getLocalStorage('a_clientId');
      let k_clientId = getLocalStorage('k_clientId');
      let enable_call = false
      let is_domain_enable = false
      let { mail, number, unique_id } = JSON.parse(getLocalStorage('userData') || '{}');

      let needsAnonymousRegistration = !a_clientId && !k_clientId && !unique_id && widgetToken && isHelloUser && !mail && !number;

      if (needsAnonymousRegistration) {
        await registerAnonymousUser();
        a_clientId = getLocalStorage(`a_clientId`);
      } else {
        // it gives the Hello Client Id for the registered user
        await fetchChannels();
        k_clientId = getLocalStorage(`k_clientId`);
      }

      //  used to subscribe to cobrowse
      emitEventToParent('uuid', { uuid: k_clientId || a_clientId })
      // Step 2: Handle domain (if needed)

      let widgetData = null;
      let jwtData = null;
      let botType = '';
      if (isHelloUser && widgetToken) {
        try {
          widgetData = await initializeHelloChat();
          if (!widgetData) {
            window.parent.postMessage({ type: 'initializeHelloChat_failed' }, '*');
          }
          window.parent.postMessage({ type: 'hide_widget', data: widgetData?.hide_launcher }, '*');
          window.parent.postMessage({ type: 'setDataInLocal', data: { key: 'widgetInfo', payload: JSON.stringify({ additionalData: { widgetToken } }) } }, '*');
          window.parent.postMessage({ type: 'launch_widget', data: widgetData?.launch_widget }, '*');
          botType = widgetData?.bot_type;
          enable_call = widgetData?.voice_call_widget;
          is_domain_enable = widgetData?.is_domain_enable
          dispatch(setWidgetInfo(widgetData));
          const customTheme = (JSON.parse(GetSessionStorageData('helloConfig') || `{}`))?.sdkConfig?.customTheme || ''
          if (!customTheme) {
            handleThemeChange(widgetData?.primary_color || "#000000");
          }
          if (widgetData?.teams && widgetData?.teams.length <= 1) {
            dispatch(setDataInAppInfoReducer({ currentTeamId: widgetData?.teams?.[0]?.id || null }));
          }
        } catch (error) {
          window.parent.postMessage({ type: 'initializeHelloChat_failed' }, '*');
          console.error("Failed to initialize Hello Chat:", error);
          return; // Exit early, don't proceed to getJwtToken
        }
      }

      if (is_domain_enable) {
        emitEventToParent("ENABLE_DOMAIN_TRACKING")
      }

      // Only get JWT token if widgetData is valid and HelloClientId exists
      if (widgetData && (getLocalStorage(`a_clientId`) || getLocalStorage(`k_clientId`))) {
        try {
          jwtData = await getJwtToken();
          if (jwtData !== null) {
            dispatch(setJwtToken(jwtData));
          }
        } catch (error) {
          console.error("Failed to fetch JWT token:", error);
        }
      }
      // Step 4: Get greeting questions (depends on widget info for company/bot IDs)
      const greetingCompanyId = widgetData?.company_id || companyId;
      const greetingBotId = widgetData?.bot_id || botId;
      if (widgetData && greetingCompanyId && greetingBotId && (getLocalStorage(`a_clientId`) || getLocalStorage(`k_clientId`)) && (botType === 'lex' || botType === 'chatgpt')) {
        await getGreetingQuestions(greetingCompanyId, greetingBotId, botType).then((data) => {
          dispatch(setGreeting({ ...data?.greeting }));
        });
      }

      if (widgetToken) {
        getAgentTeamApi().then((data) => {
          dispatch(setAgentTeams(data));
        });
      }

      // Step 5: Get client token and call token (depend on JWT)
      if ((getLocalStorage(`a_clientId`) || getLocalStorage(`k_clientId`)) && widgetToken && enable_call) {
        const clientTokenPromise = getClientToken().then(() => {
          helloVoiceService.initialize();
          if (getLocalStorage('CallId')) {
            console.log('call id present', getLocalStorage('CallId'))
            helloVoiceService.rejoinCall();
          }
        });

        const callTokenPromise = getCallToken();

        await Promise.all([clientTokenPromise, callTokenPromise]);
      }

      // Step 6: Fetch channels
      needsAnonymousRegistration && fetchChannels();

      mountedRef.current = true;
    } catch (error) {
      console.error("Error initializing Hello services:", error);
    }
  };

  return {
    helloMessages,
    loading,
    setLoading,
    sendMessageToHello,
    fetchHelloPreviousHistory,
    addHelloMessage,
    fetchChannels,
    getMoreHelloChats
  };
};

export default useHelloIntegration;