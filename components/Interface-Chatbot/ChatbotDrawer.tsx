'use client';

import { AlignLeft, Bell, ChevronDown, ChevronRight, ChevronUp, MessageSquareText, Phone, Send, Users, X } from "lucide-react";
import { useContext, useCallback, useEffect, useMemo, useState } from "react";
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
import { setThreads } from "@/store/interface/interfaceSlice";

// Utils and Types
import { ParamsEnums } from "@/utils/enums";
import { useTheme } from "@mui/material";
import { useChatActions } from "../Chatbot/hooks/useChatActions";
import { useColor } from "../Chatbot/hooks/useColor";
import { useOnSendHello } from "../Chatbot/hooks/useHelloIntegration";
import { useScreenSize } from "../Chatbot/hooks/useScreenSize";
import { stripHtmlToText } from "@/utils/utilities";
import { MessageContext } from "./InterfaceChatbot";

const createRandomId = () => Math.random().toString(36).substring(2, 15);

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

  const { images, allMessages, allMessagesData, isToggledrawer, notifications } = useCustomSelector((state) => ({
    images: state.Chat.images || [],
    allMessages: state.Chat.messageIds || [],
    allMessagesData: state.Chat.msgIdAndDataMap || {},
    isToggledrawer: state.Chat.isToggledrawer,
    notifications: state.Chat.notifications || [],
  }))

  const { currentChatId, currentTeamId, currentChannelId } = useReduxStateManagement({ chatSessionId, tabSessionId });
  const { callState } = useCallUI();
  const sendMessageToHello = useOnSendHello();
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);

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
    isFullScreen
  } = useCustomSelector((state) => {
    const show_close_button = state.Hello?.[chatSessionId]?.helloConfig?.show_close_button
    const fullScreen = state.Hello?.[chatSessionId]?.helloConfig?.fullScreen
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
      isFullScreen: (fullScreen === true || fullScreen === 'true') ?? false
    };
  });
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

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
    dispatch(setDataInAppInfoReducer({ subThreadId: sub_thread_id, showNotificationView: false }));
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
    dispatch(setDataInAppInfoReducer({ subThreadId: channelId, currentChannelId: channelId, currentChatId: chatId, currentTeamId: teamId, showNotificationView: false }));
    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);

    focusTextField();
    setLoading(false);
  };

  const handleChangeTeam = (teamId: string) => {
    dispatch(setDataInAppInfoReducer({ subThreadId: '', currentTeamId: teamId, currentChannelId: "", currentChatId: "", overrideChannelId: "", showNotificationView: false }));

    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);
    focusTextField();
    setLoading(false);
  };

  const closeToggleDrawer = (isOpen: boolean) => {
    setToggleDrawer(isOpen);
  };

  const handleVoiceCall = async () => {
    // If no channel is selected, pick the most recent (first valid) channel just for this action
    let overrideChannelId;
    let overrideChatId;
    let overrideTeamId;
    if (!currentChannelId && Array.isArray(channelList) && channelList.length > 0 && channelList?.[0]?.id) {
      const firstValid = channelList.find((ch: any) => ch?.id);
      if (firstValid) {
        overrideChannelId = firstValid?.channel;
        overrideChatId = firstValid?.id;
        dispatch(
          setDataInAppInfoReducer({
            subThreadId: firstValid?.channel,
            currentChannelId: firstValid?.channel,
            currentChatId: firstValid?.id,
            currentTeamId: firstValid?.team_id,
            showNotificationView: false,
          })
        );
      }
    } else if (teamsList?.length > 0) {
      const firstValid = teamsList[0]
      if (firstValid) {
        dispatch(
          setDataInAppInfoReducer({
            currentTeamId: firstValid?.id,
            showNotificationView: false,
          })
        );
        overrideTeamId = firstValid?.id;
      }
    }
    if (isSmallScreen) setToggleDrawer(false);
    // pass overrides so sendMessageToHello uses latest values in the same tick
    const data = await sendMessageToHello('', '', true, overrideChannelId || currentChannelId, overrideChatId || currentChatId, overrideTeamId || currentTeamId);
    helloVoiceService.initiateCall(data?.['call_jwt_token'] || '');
  };

  const handleSendMessageWithNoTeam = () => {
    dispatch(setDataInAppInfoReducer({ subThreadId: '', currentTeamId: "", currentChannelId: "", currentChatId: "", overrideChannelId: "", showNotificationView: false }));

    if (isSmallScreen) setToggleDrawer(false);
    if (images?.length > 0) setImages([]);
    focusTextField();
  };

  const unreadNotificationCount = notifications.filter(notification => !notification.read).length;

  const handleOpenNotificationView = useCallback(() => {
    dispatch(setDataInAppInfoReducer({ showNotificationView: true }));
    if (isSmallScreen) setToggleDrawer(false);
  }, [dispatch, isSmallScreen, setToggleDrawer]);

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

  const hasChannels = useMemo(() => (channelList || []).length > 0 && channelList.some((thread: any) => thread?.id), [channelList]);

  const TeamsList = useMemo(() => (
    <>
      {(hasChannels || teamsList?.length > 0 || notifications.length > 0) && (
        <div className="teams-container pb-2 relative flex flex-col h-[calc(100vh_-_185px)] overflow-y-auto">
          {/* Notifications Row — shown above conversations when push notifications exist.
              Clicking navigates to NotificationPage via showNotificationView state. */}
          {notifications.length > 0 && (
            <div className="notifications-section mb-2">
              <div
                className="notification-row px-4 py-2 cursor-pointer flex items-center gap-3 transition-all text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-white/5"
                onClick={handleOpenNotificationView}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: primaryBgColor }}
                  >
                    <Bell size={16} style={{ color: foregroundColor }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">Notifications</span>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {unreadNotificationCount > 0 && (
                    <span
                      className="min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={{ backgroundColor: '#ef4444', color: '#fff' }}
                    >
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  )}
                  <ChevronRight size={14} className="opacity-60" />
                </div>
              </div>
            </div>
          )}

          {/* Conversations Section */}
          {hasChannels && (
            <div className={`conversations-section mb-3 ${notifications.length > 0 ? '' : 'mt-3'}`}>
              <div className="conversations-header pb-2">
                <h3 className="px-4 text-[11px] font-semibold tracking-wider opacity-60 uppercase">Continue Conversations</h3>
              </div>
              <div className="conversations-list flex flex-col">
                {displayedChannels.map((channel: any, index: number) => {
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
                      const rawText = lastMessage?.message_type === 'pushNotification'
                        ? "Custom Notification"
                        : (lastMessage.messageJson?.text
                          || (lastMessage.messageJson?.attachment?.length > 0 ? "Attachment"
                            : lastMessage.messageJson?.message_type || "New conversation"));
                      const text = stripHtmlToText(rawText);
                      return `${isUserMessage ? "You: " : ""}${text || "New conversation"}`;
                    }
                    if (channel?.last_message) {
                      const isYou = !channel?.last_message?.message?.sender_id && !channel?.last_message?.message?.is_auto_response;
                      const rawText = channel?.last_message?.message?.content?.text
                        || (channel?.last_message?.message?.content?.attachment?.length > 0 ? "Attachment"
                          : channel?.last_message?.message?.message_type || "New conversation");
                      const text = stripHtmlToText(rawText);
                      return `${isYou ? "You: " : ""}${text || "New conversation"}`;
                    }
                    return "New conversation";
                  })();

                  /*const timeLabel = formatRelativeTime(
                    channel?.last_message?.timetoken
                    || channel?.last_message?.message?.timetoken
                    || channel?.last_message?.created_at
                    || channel?.updated_at
                    || channel?.last_message_at
                    || channel?.created_at
                  );*/

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
                      style={{
                        background: isActive ? primaryGradientBg : undefined,
                        opacity: isClosed ? 0.8 : undefined,
                      }}
                      className={`conversation-card group relative px-4 py-2 cursor-pointer flex items-center gap-3 transition-all ${isActive ? 'text-inherit' : 'text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-white/5'}`}
                      onClick={() => handleChangeChannel(channel?.channel, channel?.id, channel?.team_id)}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold select-none"
                          style={{
                            backgroundColor: isDarkMode ? (isActive ? 'rgba(255, 255, 255)' : 'rgba(255, 255, 255, 0.22)') : primaryTintColor,
                            color: isClosed ? (isActive ? primaryTextColor : 'var(--icon-color)') : (!isActive && isDarkMode ? foregroundColor : primaryTextColor),
                          }}
                        >
                          {initials}
                        </div>
                        {unread > 0 && (
                          <span
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: primaryBgColor, color: foregroundColor, border: '1px solid rgba(255, 255, 255, 0.22)' }}
                          >
                            {unread}
                          </span>
                        )}
                      </div>

                      <div className="conversation-info flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm truncate ${isActive || unread > 0 ? 'font-semibold' : 'font-normal'}`}>
                            {title}
                          </span>
                          {isClosed && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg border border-[var(--icon-color)] bg-transparent text-[var(--icon-color)] flex-shrink-0">
                              Closed
                            </span>
                          )}
                        </div>
                        <div
                          className="text-xs opacity-70 line-clamp-1 break-all [&_*]:inline"
                        >
                          {subtitleHtml}
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-1 opacity-60">
                        {/*{timeLabel && (
                          <span className="text-[11px] whitespace-nowrap">{timeLabel}</span>
                        )}*/}
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  );
                })}
                {filteredChannels.length > VISIBLE_ITEMS_COUNT && (
                  <div
                    className="flex justify-between items-center py-2 px-4 text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-white/5"
                    onClick={() => setShowAllChannels(!showAllChannels)}
                  >
                    <button
                      type="button"
                      className="text-sm font-medium"
                      style={{ color: (isDarkMode ? foregroundColor : primaryTextColor) }}
                    >
                      {showAllChannels
                        ? "Show less"
                        : areAllHiddenChatsClosed
                          ? `Show (${hiddenCount}) Closed Conversations`
                          : `See all ${hiddenCount} conversations`
                      }
                    </button>
                    {showAllChannels ? <ChevronUp size={14} style={{ color: isDarkMode ? foregroundColor : primaryTextColor }} /> : <ChevronDown size={14} style={{ color: isDarkMode ? foregroundColor : primaryTextColor }} />}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teams Section */}
          {(teamsList || []).length > 0 && (
            <div className={`teams-section ${notifications.length > 0 && hasChannels ? '' : 'mt-3'}`}>
              <div className="teams-header pb-2 flex items-center">
                <h3 className="px-4 text-[11px] font-semibold tracking-wider opacity-60 uppercase">Talk to our teams</h3>
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
                        className="team-card px-4 py-2 transition-all cursor-pointer flex items-center justify-between gap-3 hover:bg-gray-100 dark:hover:bg-white/5"
                        onClick={() => handleChangeTeam(team?.id)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold select-none"
                              style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.22)' : primaryTintColor, color: isDarkMode ? foregroundColor : primaryTextColor }}
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
                            <div className="team-name text-sm font-normal truncate" style={{ color: 'var(--foreground)' }}>
                              {team?.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex gap-3 items-center">
                          <MessageSquareText size={18} style={{ color: isDarkMode ? foregroundColor : primaryTextColor }} />
                          <ChevronRight size={14} className="opacity-50" />
                        </div>
                      </div>
                    );
                  })}
                  {teamsList.length > VISIBLE_ITEMS_COUNT && (
                    <div
                      className="flex justify-between items-center py-2 px-4 text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-white/5"
                      onClick={() => setShowAllTeams(!showAllTeams)}
                    >
                      <button
                        type="button"
                        style={{ color: isDarkMode ? foregroundColor : primaryTextColor }}
                        className="text-sm font-medium"
                      >
                        {showAllTeams
                          ? "Show less"
                          : `See all ${teamsList.length - VISIBLE_ITEMS_COUNT} team${teamsList.length - VISIBLE_ITEMS_COUNT > 1 ? "s" : ""}`}
                      </button>
                      {showAllTeams ? <ChevronUp size={14} style={{ color: isDarkMode ? foregroundColor : primaryTextColor }} /> : <ChevronDown size={14} style={{ color: isDarkMode ? foregroundColor : primaryTextColor }} />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Call Section */}
      <div className={`marketing-banner bg-[var(--drawer-color)] px-4 pt-3 pb-3 ${(teamsList || []).length === 0 && (filteredChannels || []).length === 0
        ? ''
        : 'mt-auto border-t border-[var(--foreground)]/10'
        }`}>
        <p className="text-sm mb-2" style={{ color: 'var(--foreground)' }}>Need specialized help?</p>
        <div className="flex gap-2">
          {voice_call_widget &&
            <button
              className={`grid place-items-center flex-1 text-sm py-2.5 rounded-xl transition-colors ${callState !== "idle"
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
          <button
            className="grid place-items-center flex-1 text-sm py-2.5 rounded-xl transition-colors hover:opacity-80"
            style={{ border: "1.5px solid currentColor", color: isDarkMode ? foregroundColor : primaryTextColor }}
            onClick={handleSendMessageWithNoTeam}
          >
            <span className="inline-flex items-center gap-2">
              <Send size={16} />
              <strong>Message</strong>
            </span>
          </button>
        </div>
      </div>
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
    notifications,
    unreadNotificationCount,
    handleOpenNotificationView,
    //tick
  ]);

  const handleCloseChatbot = () => {
    if (!window?.parent) return;
    window.parent.postMessage({ type: "CLOSE_CHATBOT" }, "*");
  };

  const headerIconBtnClass =
    'p-2 rounded-full transition-colors hover:bg-gray-300';

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
      <div className={`drawer-side ${isHelloUser && isSmallScreen ? '' : 'max-w-[286px]'} transition-transform duration-100`}>
        <div className="w-full h-full relative flex flex-col bg-[var(--drawer-color)]">
          {/* Header with padding */}
          <div className="px-4 py-4" style={{ background: primaryGradientBg, ['--header-hover-bg' as any]: headerHoverBg }}>
            <div className="flex items-center justify-between">
              <div className="w-10">
                {isToggledrawer && (
                  <button
                    className={headerIconBtnClass}
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
                  <p className="text-xs text-center opacity-80">{tagline}</p>
                )}
              </div>
              <div className="w-10 flex items-center justify-end gap-1">
                {!(hideCloseButton === true || hideCloseButton === "true" || !isSmallScreen || isFullScreen) && (
                  <button
                    className={headerIconBtnClass}
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
          <div className="flex-1 overflow-y-auto flex flex-col">
            {!isHelloUser ? DrawerList : TeamsList}
          </div>

          {/* Footer with branding - always stays at bottom */}
          {(isHelloUser && show_msg91) || !isHelloUser ? (
            <div className="px-4 pt-2 pb-2 flex items-center justify-center mt-auto">
              <div className="text-xs opacity-50 flex items-baseline gap-1" style={{ color: 'var(--foreground)' }}>
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