'use client';

import { lighten } from "@mui/material";
import { AlignLeft, ChevronRight, ChevronUp, ChevronDown, SquarePen, Users, Phone, Send, X, MessageSquareText } from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

// API and Services
import helloVoiceService from "../Chatbot/hooks/HelloVoiceService";

// HOCs and Hooks
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { useCallUI } from "../Chatbot/hooks/useCallUI";
import { useReduxStateManagement } from "../Chatbot/hooks/useReduxManagement";

// Redux Actions
import { setDataInAppInfoReducer } from "@/store/appInfo/appInfoSlice";
import { setDataInDraftReducer } from "@/store/draftData/draftDataSlice";
import { setThreads } from "@/store/interface/interfaceSlice";

// Utils and Types
import { ParamsEnums } from "@/utils/enums";
import { useChatActions } from "../Chatbot/hooks/useChatActions";
import { useColor } from "../Chatbot/hooks/useColor";
import { useScreenSize } from "../Chatbot/hooks/useScreenSize";
import { MessageContext } from "./InterfaceChatbot";
import { useOnSendHello } from "../Chatbot/hooks/useHelloIntegration";
import { emitEventToParent } from "@/utils/emitEventsToParent/emitEventsToParent";
import QuickActionsMenu from "./QuickActionsMenu";

const createRandomId = () => Math.random().toString(36).substring(2, 15);

const formatRelativeTime = (input: any): string => {
  if (input === null || input === undefined || input === '') return '';
  let ts: number;
  if (typeof input === 'number' || /^\d+$/.test(String(input))) {
    const num = Number(input);
    // PubNub timetoken is in 100ns units (17-digit). Convert to ms.
    ts = num > 1e14 ? Math.floor(num / 10000) : num;
  } else {
    ts = new Date(input).getTime();
  }
  if (!ts || isNaN(ts)) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
};

interface ChatbotDrawerProps {
  preview?: boolean;
  chatSessionId: string
  tabSessionId: string
  subThreadId?: string;
  bridgeName: string;
  threadId: string
}

const ChatbotDrawer = ({
  preview = false,
  chatSessionId,
  tabSessionId,
  subThreadId,
  bridgeName,
  threadId
}: ChatbotDrawerProps) => {
  const dispatch = useDispatch();
  const { primaryTextColor, primaryBgColor, foregroundColor, primaryGradientBg, primaryTintColor, headerHoverBg } = useColor();

  // Context hooks
  const { messageRef } = useContext(MessageContext);
  const { isSmallScreen } = useScreenSize();

  const { setNewMessage, setOptions, setImages, setLoading, setToggleDrawer } = useChatActions();

  const { images, allMessages, allMessagesData, isToggledrawer } = useCustomSelector((state) => ({
    images: state.Chat.images || [],
    allMessages: state.Chat.messageIds || [],
    allMessagesData: state.Chat.msgIdAndDataMap || {},
    isToggledrawer: state.Chat.isToggledrawer,
  }))

  const { currentChatId, currentTeamId, currentChannelId } = useReduxStateManagement({ chatSessionId, tabSessionId });
  const { callState } = useCallUI();
  const sendMessageToHello = useOnSendHello();
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);

  // Tick state — bumps every 30s AND on every inbound `SET_BADGE_COUNT` postMessage,
  // forcing time labels like "14m" → "15m" to re-render against fresh `Date.now()`.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data: any = e?.data;
      const type = typeof data === 'string' ? data : data?.type;
      if (type === 'SET_BADGE_COUNT') {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Consolidated Redux state selection
  const {
    subThreadList,
    teamsList,
    channelList,
    isHelloUser,
    Name,
    tagline,
    hideCloseButton,
    voice_call_widget,
    show_msg91,
    isChatbotMinimized,
    isMobileSDK,
    isFullScreen,
    isChatbotFullScreen
  } = useCustomSelector((state) => {
    const show_close_button = state.Hello?.[chatSessionId]?.helloConfig?.show_close_button
    const helloFullScreen = state.Hello?.[chatSessionId]?.helloConfig?.fullScreen
    return {
      subThreadList: state.Interface?.[chatSessionId]?.interfaceContext?.[bridgeName]?.threadList?.[threadId] || [],
      teamsList: state.Hello?.[chatSessionId]?.widgetInfo?.teams || [],
      channelList: state.Hello?.[chatSessionId]?.channelListData?.channels || [],
      isHelloUser: state.draftData?.isHelloUser || false,
      Name: state?.Hello?.[chatSessionId]?.clientInfo?.Name || state.Hello?.[chatSessionId]?.channelListData?.customer_name || '',
      tagline: state.Hello?.[chatSessionId]?.widgetInfo?.tagline || '',
      hideCloseButton: typeof show_close_button === 'boolean' ? !show_close_button : state.appInfo?.[tabSessionId]?.hideCloseButton || false,
      voice_call_widget: state.Hello?.[chatSessionId]?.widgetInfo?.voice_call_widget || false,
      show_msg91: state.Hello?.[chatSessionId]?.widgetInfo?.show_msg91 || false,
      isChatbotMinimized: state.draftData?.isChatbotMinimized || false,
      isMobileSDK: state.Hello?.[chatSessionId]?.helloConfig?.isMobileSDK || false,
      isFullScreen: (helloFullScreen === true || helloFullScreen === 'true') ?? false,
      isChatbotFullScreen: state.draftData?.isChatbotFullScreen || false
    };
  });

  const VISIBLE_ITEMS_COUNT = 3;
  const filteredChannels = (channelList || []).filter(
    (channel: any) => channel?.id
  );

  const closedChatsCount = filteredChannels.filter(
    (channel: any) => channel?.is_closed
  ).length;

  const displayedChannels = showAllChannels
  ? filteredChannels
  : filteredChannels.slice(0, VISIBLE_ITEMS_COUNT);

  const displayedTeams = showAllTeams
  ? teamsList
  : teamsList.slice(0, VISIBLE_ITEMS_COUNT);


  const hiddenChannels = filteredChannels.slice(VISIBLE_ITEMS_COUNT);
  const hiddenCount = hiddenChannels.length;

  const areAllHiddenChatsClosed =
    hiddenCount > 0 &&
    hiddenChannels.every((channel: any) => channel?.is_closed);

  useEffect(() => {
    if (chatSessionId) {
      setToggleDrawer(true);
    }
  }, [chatSessionId])

  // Handlers
  const handleCreateNewSubThread = async () => {
    if (preview) return;
    if (subThreadList?.[0]?.newChat) {
      return;
    }
    const newThreadData = {
      sub_thread_id: createRandomId(),
      thread_id: threadId,
      display_name: "New Chat",
      newChat: "true"
    }
    if (!subThreadList?.[0]?.newChat) {
      dispatch(
        setThreads({
          newThreadData,
          bridgeName: bridgeName,
          threadId: threadId,
        })

      );
      setOptions([]);

    }
  };

  const handleChangeSubThread = (sub_thread_id: string) => {
    setLoading(false);
    dispatch(setDataInAppInfoReducer({ subThreadId: sub_thread_id }));
    setNewMessage(true);
    setOptions([]);
    focusTextField();

    if (isSmallScreen) {
      setToggleDrawer(false);
    }
  };

  const focusTextField = () => {
    if (messageRef.current) {
      messageRef.current?.focus();
    }
  }

  const handleChangeChannel = async (channelId: string, chatId: string, teamId: string) => {
    // Update redux state
    dispatch(setDataInAppInfoReducer({ subThreadId: channelId, currentChannelId: channelId, currentChatId: chatId, currentTeamId: teamId }));
    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);

    focusTextField();
    setLoading(false);
  };

  const handleChangeTeam = (teamId: string) => {
    dispatch(setDataInAppInfoReducer({ subThreadId: '', currentTeamId: teamId, currentChannelId: "", currentChatId: "", overrideChannelId: "" }));

    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);
    focusTextField();
    setLoading(false);
  };

  const closeToggleDrawer = (isOpen: boolean) => {
    setToggleDrawer(isOpen);
  };

  const handleVoiceCall = async () => {
    // Voice call should always start a FRESH chat — never reuse an existing
    // chat_id. We only use the team selection (if any) to route the call.
    let overrideTeamId;
    if (Array.isArray(teamsList) && teamsList.length > 0) {
      const firstValid = teamsList[0];
      if (firstValid) {
        overrideTeamId = firstValid?.id;
        dispatch(
          setDataInAppInfoReducer({
            currentTeamId: firstValid?.id,
          })
        );
      }
    }
    if (isSmallScreen) setToggleDrawer(false);
    // Force a fresh chat by clearing chat_id / channel_id before sending.
    dispatch(setDataInAppInfoReducer({
      subThreadId: '',
      currentChannelId: '',
      currentChatId: '',
      overrideChannelId: '',
    }));
    // Pass empty chatId/channelId overrides so sendMessageToHello creates a new chat.
    const data = await sendMessageToHello('', '', true, '', '', overrideTeamId || currentTeamId);
    helloVoiceService.initiateCall(data?.['call_jwt_token'] || '');
  };

  const handleSendMessageWithNoTeam = () => {
    dispatch(setDataInAppInfoReducer({ subThreadId: '', currentTeamId: "", currentChannelId: "", currentChatId: "", overrideChannelId: "" }));

    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);
    focusTextField();
  };

  // Memoized components
  const DrawerList = useMemo(() => (
    <div className="menu p-0 w-full h-full bg-[var(--drawer-color)] text-base-content">
      {(subThreadList || []).length === 0 ? (
        <div className="flex justify-center items-center mt-5">
          <span>No Conversations</span>
        </div>
      ) : (
        <ul>
          {subThreadList.map((thread: any, index: number) => (
            <li key={`${thread?._id}-${index}`}>
              <a
                className={`${thread?.sub_thread_id === subThreadId ? 'active' : ''}`}
                onClick={() => handleChangeSubThread(thread?.sub_thread_id)}
              >
                {thread?.display_name || thread?.sub_thread_id}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  ), [subThreadList, subThreadId, handleChangeSubThread]);

  const TeamsList = useMemo(() => (
      <>
        {((channelList?.length > 0 && channelList.some((thread: any) => thread?.id)) || teamsList?.length > 0) && (
          <div className="teams-container pb-2 relative gap-5 flex flex-col h-[calc(100vh_-_185px)] overflow-y-auto">
      {/* Conversations Section */}
      {(channelList || []).length > 0 && channelList.some((thread: any) => thread?.id) && (
        <div className="conversations-section">
          <div className="conversations-header pb-2">
            <h3 className="px-4 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Continue Conversations</h3>
          </div>
          <div className="conversations-list flex flex-col">
            { displayedChannels.map((channel: any, index: number) => {
              const isActive = channel?.id === currentChatId;
              const unread = channel?.widget_unread_count || 0;
              const isClosed = !!channel?.is_closed;
              const channelMessages = allMessages?.[channel?.channel];
              const lastMessageId = channelMessages?.[0];
              const lastMessage = lastMessageId ? allMessagesData?.[channel?.channel]?.[lastMessageId] : null;

              const lastMsgType = channel?.last_message?.message?.message_type
                || lastMessage?.messageJson?.message_type
                || lastMessage?.message_type;

              const titleByType: Record<string, string> = {
                voice_call: 'Voice Call',
                text: 'Chat',
                pushNotification: 'Notification',
                image: 'Image',
                video: 'Video',
                file: 'Attachment',
                audio: 'Audio',
              };

              const title = channel?.assigned_to?.name
                || (lastMsgType && titleByType[lastMsgType])
                || 'Conversation';

              const subtitleHtml = (() => {
                if (lastMessage) {
                  const isUserMessage = lastMessage?.role == "user" || lastMessage?.role === "voice_call";
                  const text = lastMessage?.message_type === 'pushNotification'
                    ? "Custom Notification"
                    : (lastMessage.messageJson?.text
                      || (lastMessage.messageJson?.attachment?.length > 0 ? "Attachment"
                        : lastMessage.messageJson?.message_type || "New conversation"));
                  return `${isUserMessage ? "You: " : ""}${text}`;
                }
                if (channel?.last_message) {
                  const isYou = !channel?.last_message?.message?.sender_id;
                  const text = channel?.last_message?.message?.content?.text
                    || (channel?.last_message?.message?.content?.attachment?.length > 0 ? "Attachment"
                      : channel?.last_message?.message?.message_type || "New conversation");
                  return `${isYou ? "You: " : ""}${text}`;
                }
                return "New conversation";
              })();

              const timeLabel = formatRelativeTime(
                channel?.last_message?.timetoken
                || channel?.last_message?.message?.timetoken
                || channel?.last_message?.created_at
                || channel?.updated_at
                || channel?.last_message_at
                || channel?.created_at
              );

              const initials = (() => {
                if (channel?.assigned_to?.name) {
                  const name = channel.assigned_to.name.toString() || '';
                  const parts = name.split(' ').filter(Boolean);
                  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
                  return name.length > 1
                    ? (name[0] + name[1]).toUpperCase()
                    : (name[0] || 'A').toUpperCase();
                }
                return 'A';
              })();

              return (
                <div
                  key={`${channel?._id}-${index}`}
                  className={`conversation-card group relative px-4 py-3 cursor-pointer flex items-center gap-3 transition-all ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  onClick={() => handleChangeChannel(channel?.channel, channel?.id, channel?.team_id)}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold select-none ${isClosed ? 'text-gray-500' : ''}`}
                      style={{
                        backgroundColor: primaryTintColor,
                        color: isClosed ? undefined : primaryTextColor,
                      }}
                    >
                      {initials}
                    </div>
                    {unread > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: primaryBgColor, color: foregroundColor }}
                      >
                        {unread}
                      </span>
                    )}
                  </div>

                  <div className="conversation-info flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-semibold truncate ${isClosed ? 'text-gray-500' : 'text-gray-900'}`}>
                        {title}
                      </span>
                      {isClosed && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg border bg-gray-100 text-gray-500 flex-shrink-0">
                          Closed
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs text-gray-500 line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: subtitleHtml }}
                    />
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1 text-gray-400">
                    {timeLabel && (
                      <span className="text-[11px] whitespace-nowrap">{timeLabel}</span>
                    )}
                    <ChevronRight size={14} />
                  </div>
                </div>
              );
            })}
            {filteredChannels.length > VISIBLE_ITEMS_COUNT && (
              <div className="flex justify-between items-center mt-2 px-4">
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  style={{ color: primaryTextColor }}
                  onClick={() => setShowAllChannels(!showAllChannels)}
                >
                  {showAllChannels
                    ? "Show less"
                    : areAllHiddenChatsClosed
                      ? `Show (${hiddenCount}) Closed Conversations`
                      : `See all ${hiddenCount} conversations`
                  }
                </button>
                { showAllChannels ? <ChevronUp size={14} style={{ color: primaryTextColor }} /> : <ChevronDown size={14} style={{ color: primaryTextColor }} /> }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teams Section */}
      {(teamsList || []).length > 0 && (
      <div className="teams-section">
        <div className="teams-header pb-2 flex items-center">
          <h3 className="px-4 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Talk to our teams</h3>
        </div>
        <div className="teams-list">
            <div className="flex flex-col">
              {displayedTeams.map((team: any, index: number) => {
                const onlineCount = team?.online_users_count ?? team?.online_count ?? team?.online;
                const memberCount = team?.members_count ?? team?.total_members ?? team?.member_count;
                const initials = (team?.name?.split(' ').filter(Boolean) || [])
                  .slice(0, 2)
                  .map((w: string) => w[0]?.toUpperCase())
                  .join('') || 'T';
                return (
                  <div
                    key={`${team?.id}-${index}`}
                    className="team-card px-4 py-3 transition-all cursor-pointer flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-white/5"
                    onClick={() => handleChangeTeam(team?.id)}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold select-none"
                          style={{ backgroundColor: primaryTintColor, color: primaryTextColor }}
                        >
                          {initials || (team?.icon || <Users size={14} />)}
                        </div>
                        {team?.widget_unread_count > 0 && (
                          <span
                            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{ backgroundColor: primaryBgColor, color: foregroundColor }}
                          >
                            {team?.widget_unread_count}
                          </span>
                        )}
                      </div>

                      <div className="team-info overflow-hidden min-w-0">
                        <div className="team-name text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {team?.name}
                        </div>
                        {(onlineCount != null || memberCount != null) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            {onlineCount != null && (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-green-600 font-medium">{onlineCount} online</span>
                              </span>
                            )}
                            {onlineCount != null && memberCount != null && (
                              <span className="text-gray-300">·</span>
                            )}
                            {memberCount != null && (
                              <span>{memberCount} members</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-3 items-center">
                      <MessageSquareText size={18} style={{ color: primaryTextColor }} />
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </div>
                );
              })}
              {teamsList.length > VISIBLE_ITEMS_COUNT && (
                <div className="flex justify-between items-center mt-2 px-4">
                  <button
                    type="button"
                    style={{ color: primaryTextColor }}
                    className="text-sm font-medium hover:underline"
                    onClick={() => setShowAllTeams(!showAllTeams)}
                  >
                    {showAllTeams
                      ? "Show less"
                      : `See all ${teamsList.length - VISIBLE_ITEMS_COUNT} team${teamsList.length - VISIBLE_ITEMS_COUNT > 1 ? "s" : ""}`}
                  </button>
                  { showAllTeams ? <ChevronUp size={14} style={{ color: primaryTextColor }} /> : <ChevronDown size={14} style={{ color: primaryTextColor }} /> }
                </div>
              )}
            </div>
        </div>
      </div>
      )}
    </div>
    )}

    {/* Voice Call Section */}
    {(voice_call_widget || (teamsList || []).length ===  0)&& (
      <div className={`marketing-banner bg-[var(--drawer-color)] px-4 pt-3 pb-3 ${
        (teamsList || []).length === 0 && (filteredChannels || []).length === 0
          ? ''
          : 'mt-auto border-t border-gray-100'
      }`}>
        <p className="text-sm mb-2">Need specialized help?</p>
        <div className="flex gap-2">
        {voice_call_widget &&
          <button
            className={`grid place-items-center flex-1 text-sm py-2.5 rounded-xl transition-colors ${
              callState !== "idle"
                ? "bg-gray-400 cursor-not-allowed"
                : "hover:opacity-90"
            }`}
            style={{
              background: callState !== "idle" ? undefined : primaryBgColor,
              color: foregroundColor,
            }}
            onClick={handleVoiceCall}
            disabled={callState !== "idle"}
          >
            <span className="inline-flex items-center gap-2">
              <Phone size={16} />
              <strong>Call Us</strong>
            </span>
          </button>
        }

          {/*Send Message button in case of no team assign */}
          { (teamsList || []).length ===  0 && (
            <button
              className="grid place-items-center flex-1 text-sm py-2.5 rounded-xl transition-colors hover:bg-gray-50"
              style={{ border: "1.5px solid currentColor", color: primaryTextColor }}
              onClick={handleSendMessageWithNoTeam}
            >
              <span className="inline-flex items-center gap-2">
                <Send size={16} />
                <strong>Message</strong>
              </span>
            </button>
          )}
        </div>
      </div>
    )}
    </>
  ), [
    channelList,
    teamsList,
    currentChatId,
    currentTeamId,
    callState,
    voice_call_widget,
    primaryTextColor,
    primaryBgColor,
    handleChangeChannel,
    handleChangeTeam,
    handleSendMessageWithNoTeam,
    handleVoiceCall,
    allMessages,
    allMessagesData,
    tick
  ]);

  const handleCloseChatbot = () => {
    if (!window?.parent) return;
    window.parent.postMessage({ type: "CLOSE_CHATBOT" }, "*");
  };

  const handleMinimizeChatbot = (value: boolean) => {
    dispatch(setDataInDraftReducer({ isChatbotMinimized: value }));
  };

  // Fullscreen state lives in redux (draftData) so the header and drawer share a
  // single source of truth and never drift (prevents the double-click collapse bug).
  const fullScreen = isChatbotFullScreen;

  const toggleFullScreen = (enter: boolean) => {
    if (!window?.parent) return;
    dispatch(setDataInDraftReducer({ isChatbotFullScreen: enter }));
    const message = enter
      ? { type: "ENTER_FULL_SCREEN_CHATBOT" }
      : { type: "EXIT_FULL_SCREEN_CHATBOT" };
    window.parent.postMessage(message, "*");
  };

  const handleToggleMinimize = () => {
    if (!isChatbotMinimized && fullScreen) {
      toggleFullScreen(false);
    }
    handleMinimizeChatbot(!isChatbotMinimized);
    if (!isChatbotMinimized) {
      emitEventToParent('MINIMIZE_CHATBOT');
    } else {
      toggleFullScreen(false);
    }
  };

  // Quick Actions dropdown for the drawer header
  const canMinimize = false; //isHelloUser && !isMobileSDK;
  const canFullScreen = !isMobileSDK && !isFullScreen;

  const DrawerQuickActionsMenu = useMemo(() => {
    if (fullScreen || isFullScreen) return null;
    if (!isToggledrawer) return null;

    return (
      <QuickActionsMenu
        isChatbotMinimized={isChatbotMinimized}
        fullScreen={fullScreen}
        showMinimize={canMinimize}
        showFullScreen={canFullScreen}
        showNewConversation={!isHelloUser}
        onMinimize={handleToggleMinimize}
        onToggleFullScreen={() => toggleFullScreen(!fullScreen)}
        onNewConversation={handleCreateNewSubThread}
        triggerClassName="p-2 rounded-full transition-colors icn"
        menuClassName="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999] py-1"
        useIconColor
        triggerHoverBg={headerHoverBg}
      />
    );
  }, [
    isToggledrawer,
    isHelloUser,
    isChatbotMinimized,
    fullScreen,
    isFullScreen,
    canMinimize,
    canFullScreen,
    handleToggleMinimize,
    toggleFullScreen,
    handleCreateNewSubThread,
    headerHoverBg,
  ]);

  const headerIconBtnClass =
    'p-2 rounded-full transition-colors icn';
  // Inline hover via onMouseEnter/Leave keeps the wash on-theme regardless
  // of Tailwind / dark-mode variants.
  const bindHeaderHover = () => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = headerHoverBg;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
    },
  });

  return (
    <div className={`drawer ${isSmallScreen ? 'z-[99999]' : 'z-[999]'}`}>
      <input
        id="chatbot-drawer"
        type="checkbox"
        className="drawer-toggle lg:hidden"
        checked={isToggledrawer}
        onChange={(e) => setToggleDrawer(e.target.checked)}
      />

      {/* Backdrop overlay for mobile */}
      {isToggledrawer && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => closeToggleDrawer(false)}
        />
      )}

      <div className={`drawer-side ${isHelloUser && isSmallScreen ? '100%' : 'max-w-[286px]'} ${isToggledrawer ? 'lg:translate-x-0' : 'lg:-translate-x-full'} transition-transform duration-100`}>
        <div className="w-full h-full relative flex flex-col bg-[var(--drawer-color)]">
          {/* Header with padding */}
          <div className="px-4 py-4" style={{ background: primaryGradientBg }}>
            <div className="flex items-center justify-between">
              <div className="w-10">
                {isToggledrawer && (
                  <button
                    className={headerIconBtnClass}
                    {...bindHeaderHover()}
                    onClick={() => closeToggleDrawer(!isToggledrawer)}
                  >
                    <AlignLeft size={22} />
                  </button>
                )}
              </div>
              <div className="flex flex-col items-center justify-center flex-1 p-2">
                <h2 className="text-lg font-bold text-center">
                  {Name ? `Hello, ${Name.split(' ')[0]} 👋` : 'Hello there! 👋'}
                </h2>
                {tagline && (
                  <p className="text-xs text-gray-500 text-center">{tagline}</p>
                )}
              </div>
              <div className="w-10 flex items-center justify-end gap-1">
                {isToggledrawer && !(fullScreen || isFullScreen) && DrawerQuickActionsMenu}
                {isToggledrawer && !(fullScreen || isFullScreen) && !hideCloseButton && (
                  <button
                    className={headerIconBtnClass}
                    {...bindHeaderHover()}
                    onClick={handleCloseChatbot}
                    aria-label="Close chat"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content area with overflow handling - the scrollbar will appear at the edge */}
          <div className="flex-1 overflow-y-auto flex flex-col pt-4">
              {!isHelloUser ? DrawerList : TeamsList}
          </div>

          {/* Footer with branding - always stays at bottom */}
          {(isHelloUser && show_msg91) || !isHelloUser ? (
            <div className="px-4 pt-2 pb-2 flex items-center justify-center mt-auto">
              <div className="text-xs text-gray-500 flex items-baseline gap-1">
                {isHelloUser && show_msg91 ? (
                  <>
                    Powered by
                    <a href="https://msg91.com" target="_blank" rel="noopener noreferrer" className="flex hover:opacity-80 transition-opacity ml-1">
                      <img src="/msg91-logo.svg" alt="MSG91" className="h-4" />
                    </a>
                  </>
                ) : (
                  <>
                    Powered by
                    <a href="https://gtwy.ai" target="_blank" rel="noopener noreferrer" className="flex hover:opacity-80 transition-opacity">
                      <span className="font-bold">GTWY</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default addUrlDataHoc(ChatbotDrawer, [ParamsEnums.subThreadId, ParamsEnums.bridgeName, ParamsEnums.threadId]);