'use client';

import { lighten } from "@mui/material";
import { AlignLeft, ChevronRight, SquarePen, Users, Phone, Send, X } from "lucide-react";
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
  const { backgroundColor, textColor, primaryGradientBg } = useColor();

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
    isFullScreen
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
      isFullScreen: (helloFullScreen === true || helloFullScreen === 'true') ?? false
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
          })
        );
      }
    } else if (teamsList?.length > 0) {
      const firstValid = teamsList[0]
      if (firstValid) {
        dispatch(
          setDataInAppInfoReducer({
            currentTeamId: firstValid?.id,
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
          <div className="teams-container pb-2 relative gap-4 flex flex-col h-[calc(100vh_-_185px)] overflow-y-auto">
      {/* Conversations Section */}
      {(channelList || []).length > 0 && channelList.some((thread: any) => thread?.id) && (
        <div className="conversations-section">
          <div className="conversations-header pb-2">
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase">Continue Conversations</h3>
          </div>
          <div className="conversations-list space-y-2">
            { displayedChannels.map((channel: any, index: number) => (
                <div
                  key={`${channel?._id}-${index}`}
                  className={`conversation-card max-h-16 h-full overflow-hidden text-ellipsis p-3 ${channel?.id === currentChatId ? 'border-2 border-primary' : ''} bg-white dark:bg-[var(--background)] rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center`}
                  style={{
                    borderColor: channel?.id === currentChatId ? backgroundColor : ''
                  }}
                  onClick={() => handleChangeChannel(channel?.channel, channel?.id, channel?.team_id)}
                >
                  <div className="w-9 h-9 flex items-center justify-center text-xs font-bold rounded-full mr-3" style={{ background: lighten(backgroundColor, 0.8), color: "#606060" }}>
                    {(() => {
                      if (channel?.assigned_to?.name) {
                        const name = channel.assigned_to.name.toString() || '';
                        const nameParts = name.split(' ');
                        if (nameParts.length > 1) {
                          // If there are multiple words, take first letter of first and second word
                          return nameParts[0].charAt(0).toUpperCase() + nameParts[1].charAt(0).toUpperCase();
                        } else {
                          // If there's only one word, take first two letters
                          return name.length > 1 ?
                            name.charAt(0).toUpperCase() + name.charAt(1).toUpperCase() :
                            name.charAt(0).toUpperCase();
                        }
                      } else {
                        return "A";
                      }
                    })()}
                  </div>
                  <div className="conversation-info flex-1 min-w-0 pr-1">
                    {channel?.channel && allMessages && allMessagesData && (
                      <div className="last-message text-sm font-medium truncate flex flex-row items-center gap-1 text-ellipsis overflow-hidden">
                        {(() => {
                          const channelMessages = allMessages[channel?.channel];
                          if (channelMessages && channelMessages?.length > 0) {
                            const lastMessageId = channelMessages[0];
                            const lastMessage = allMessagesData[channel?.channel]?.[lastMessageId];
                            if (lastMessage) {
                              const isUserMessage = lastMessage?.role == "user" || lastMessage?.role === "voice_call";
                              return (
                                <>
                                  {isUserMessage ? "You: " : "Sender: "}
                                  <div className="line-clamp-1" dangerouslySetInnerHTML={{
                                    __html: lastMessage?.message_type === 'pushNotification'
                                      ? "Custom Notification"
                                      : (lastMessage.messageJson?.text ||
                                        (lastMessage.messageJson?.attachment?.length > 0 ? "Attachment" :
                                          lastMessage.messageJson?.message_type ||
                                          "New conversation"))
                                  }}></div>
                                </>
                              );
                            }
                          }

                          // Fallback to channel.last_message if no message found in allMessagesData
                          if (channel?.last_message) {
                            return (
                              <>
                                {!channel?.last_message?.message?.sender_id ? "You: " : "Sender: "}
                                <div className="line-clamp-1" dangerouslySetInnerHTML={{
                                  __html: channel?.last_message?.message?.content?.text ||
                                    (channel?.last_message?.message?.content?.attachment?.length > 0 ? "Attachment" :
                                      channel?.last_message?.message?.message_type ||
                                      "New conversation")
                                }}></div>
                              </>
                            );
                          }

                          return "New conversation";
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center">
                    {channel?.widget_unread_count > 0 && (
                      <div className="text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center mr-2" style={{ backgroundColor: backgroundColor, color: textColor }}>
                        {channel?.widget_unread_count}
                      </div>
                    )}
                    <ChevronRight size={16} className="var(--icon-color)" />
                  </div>
                </div>
              ))}
              {filteredChannels.length > VISIBLE_ITEMS_COUNT && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    className="text-sm font-medium hover:underline"
                    style={{ color: backgroundColor}}
                    onClick={() => setShowAllChannels(!showAllChannels)}
                  >
                    {showAllChannels
                      ? "Show Less"
                      : (filteredChannels.length - closedChatsCount) <= VISIBLE_ITEMS_COUNT
                        ? `Show (${filteredChannels.length - VISIBLE_ITEMS_COUNT}) Closed Conversations`
                        : `Show All (${filteredChannels.length - VISIBLE_ITEMS_COUNT}) Conversations`
                    }
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Teams Section */}
      {(teamsList || []).length > 0 && (
      <div className="teams-section">
        <div className="teams-header pb-2 flex items-center">
          <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase">Talk to our experts</h3>
        </div>
        <div className="teams-list space-y-0">
            <div className="flex flex-col gap-1">
              {displayedTeams.map((team: any, index: number) => (
                <div
                  key={`${team?.id}-${index}`}
                  className={`team-card px-4 py-2 transition-all cursor-pointer flex items-center justify-between`}
                  onClick={() => handleChangeTeam(team?.id)}
                >
                  <div className="flex items-center overflow-hidden">
                    <div className="relative flex-shrink-0 mr-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold select-none bg-blue-50 text-blue-600">
                        {team?.name?.charAt(0)?.toUpperCase() || (team?.icon || <Users size={14} />)}
                      </div>
                      {team?.widget_unread_count > 0 && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: "rgb(37, 99, 235)" }}
                        >
                          {team?.widget_unread_count}
                        </span>
                      )}
                    </div>

                    <div className="team-info overflow-hidden">
                      <div className="team-name font-medium truncate max-w-full">{team?.name}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <SquarePen size={16} color="var(--icon-color)" />
                  </div>
                </div>
              ))}

              {teamsList.length > VISIBLE_ITEMS_COUNT && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    style={{ color: backgroundColor }}
                    className="text-sm font-medium hover:underline"
                    onClick={() => setShowAllTeams(!showAllTeams)}
                  >
                    {showAllTeams
                      ? "Show Less"
                      : `Show All (${teamsList.length -  VISIBLE_ITEMS_COUNT})`}
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>
      )}
    </div>
    )}

    {/* Voice Call Section */}
    {voice_call_widget && (
      <div className="marketing-banner mt-auto sticky bottom-0 bg-[var(--drawer-color)] pt-3">
        <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase">Talk to Our Teams</h3>
        <div className="flex gap-2 mt-3">
          <button
            className={`grid place-items-center flex-1 text-xs p-3 rounded-md transition-colors ${
              callState !== "idle"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-primaryTheme hover:bg-primaryTheme/80"
            }`}
            style={{ color: textColor, borderRadius: "14px" }}
            onClick={handleVoiceCall}
            disabled={callState !== "idle"}
          >
            <span className="inline-flex items-center gap-2">
              <Phone size={18} />
              <strong>Call Us</strong>
            </span>
          </button>
          {/*Send Message button in case of no team assign */}
          { (teamsList || []).length ===  0 && (
            <button className="grid place-items-center flex-1 text-xs p-3 rounded-md transition-colors" style={{ border: "2px solid " + backgroundColor, color: backgroundColor, borderRadius: "14px" }} onClick={handleSendMessageWithNoTeam}>
              <span className="inline-flex items-center gap-2">
                <Send size={18} />
                <strong>Send Message</strong>
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
    backgroundColor,
    handleChangeChannel,
    handleChangeTeam,
    handleSendMessageWithNoTeam,
    handleVoiceCall,
    allMessages,
    allMessagesData
  ]);

  const handleCloseChatbot = () => {
    if (!window?.parent) return;
    window.parent.postMessage({ type: "CLOSE_CHATBOT" }, "*");
  };

  const handleMinimizeChatbot = (value: boolean) => {
    dispatch(setDataInDraftReducer({ isChatbotMinimized: value }));
  };

  const [fullScreen, setFullScreen] = useState(false);

  const toggleFullScreen = (enter: boolean) => {
    if (!window?.parent) return;
    setFullScreen(enter);
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
        triggerClassName="p-2 hover:bg-gray-200 rounded-full transition-colors icn"
        menuClassName="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999] py-1"
        useIconColor
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
  ]);

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
            <div className="flex items-start justify-between">
              <div className="w-10">
                {isToggledrawer && (
                  <button
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors icn"
                    onClick={() => closeToggleDrawer(!isToggledrawer)}
                  >
                    <AlignLeft size={22} />
                  </button>
                )}
              </div>
              <div className="flex flex-col items-center justify-center flex-1 mt-[40px]">
                <h2 className="text-lg font-bold text-center">
                  {Name ? `Hello ${Name.split(' ')[0]}` : 'Hello There!'}
                </h2>
                {tagline && (
                  <p className="text-xs text-gray-500 text-center">{tagline}</p>
                )}
              </div>
              <div className="w-10 flex items-center justify-end gap-1">
                {isToggledrawer && DrawerQuickActionsMenu}
                {isToggledrawer && !hideCloseButton && (
                  <button
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors icn"
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