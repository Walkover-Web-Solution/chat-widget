// Icons
import {
  AlignLeft,
  Maximize2,
  Minimize2,
  Minus,
  X
} from "lucide-react";

// Third-party libraries
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
// App imports
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { setDataInDraftReducer } from "@/store/draftData/draftDataSlice";
import { $ReduxCoreType } from "@/types/reduxCore";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { emitEventToParent } from "@/utils/emitEventsToParent/emitEventsToParent";
import { ParamsEnums } from "@/utils/enums";
import { useChatActions } from "../Chatbot/hooks/useChatActions";
import { useColor } from "../Chatbot/hooks/useColor";
import QuickActionsMenu from "./QuickActionsMenu";
import "./InterfaceChatbot.css";
import { useScreenSize } from '../Chatbot/hooks/useScreenSize';

function getAgentTeamName(state: $ReduxCoreType, chatSessionId: string, currentChannelId: string = "") {
  const agent_teams = state.Hello?.[chatSessionId]?.agent_teams || {};
  const channel = state.Hello?.[chatSessionId]?.channelListData?.channels?.find(
    (channel: any) => channel?.channel === currentChannelId
  );
  const assigned_type = channel?.assigned_type;
  const assigned_id = channel?.assigned_id;
  if (assigned_type === "team" && assigned_id) {
    return agent_teams?.teams?.[assigned_id] || "";
  } else if (assigned_type === "agent" && assigned_id) {
    return agent_teams?.agents?.[assigned_id] || "";
  } else {
    return null;
  }
}

interface ChatbotHeaderProps {
  chatSessionId: string
  tabSessionId: string
  currentTeamId: string
  currentChannelId: string
}

const ChatbotHeader: React.FC<ChatbotHeaderProps> = ({ chatSessionId, tabSessionId, currentTeamId = "", currentChannelId = "" }) => {
  const dispatch = useDispatch();
  const { setToggleDrawer } = useChatActions();
  const { foregroundColor, headerHoverBg } = useColor();
  const { isSmallScreen } = useScreenSize();

  // Wrapper component so header icon peers (buttons, dropdowns) inherit the
  // correct icon/text color based on the primary gradient (white for dark mode,
  // auto/light for light mode). The #chatbot-header-root selector is used by
  // any downstream dropdowns/menus that mount outside the header root.
  const HeaderColorWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      id="chatbot-header-root"
      className={`w-full ${isSmallScreen ? 'border-b border-gray-100' : ''}`}
      style={{
        backgroundColor: isSmallScreen ? 'var(--background)' : undefined,
        ['--header-hover-bg' as any]: headerHoverBg,
      }}
    >
      {children}
    </div>
  );

  const { isToggledrawer, lastMessage, unReadCount, isChatbotMinimized, isFullScreen, isOpenInParentContainer, unreadNotifications, unreadTotalMsgs } = useCustomSelector((state) => {
    const helloConfig = state.Hello?.[chatSessionId]?.helloConfig;
    const fullScreen = helloConfig?.fullScreen

    // Find parent id if pass in hello config
    const parentId = Boolean(helloConfig?.parentId);

    return {
      isToggledrawer: state.Chat?.isToggledrawer,
      lastMessage: (() => {
        const lastMessageId = state.Chat?.messageIds?.[currentChannelId]?.[0]
        return state.Chat?.msgIdAndDataMap?.[currentChannelId]?.[lastMessageId]
      })(),
      unReadCount: state.Hello?.[chatSessionId]?.channelListData?.channels?.find(
        (channel: any) => channel?.channel === currentChannelId
      )?.widget_unread_count || 0,
      isChatbotMinimized: state.draftData?.isChatbotMinimized || false,
      isFullScreen: (fullScreen === true || fullScreen === 'true') ?? false,
      isOpenInParentContainer: parentId,
      unreadNotifications: (state.Chat?.notifications || []).filter((notification: any) => !notification.read).length,
      unreadTotalMsgs: (state.Hello?.[chatSessionId]?.channelListData?.channels || []).reduce(
        (acc: number, c: any) => acc + (c?.widget_unread_count || 0), 0
      )
    }
  }
  )

  const fullScreen = !isSmallScreen;
  const [teamName, setTeamName] = useState(false);

  const handleMinimizeChatbot = (value: boolean) => {
    dispatch(setDataInDraftReducer({ isChatbotMinimized: value }));
  }

  const {
    hideCloseButton,
    teams,
    agentTeamName,
    isMobileSDK,
    showNotificationView,
    notificationsCount
  } = useCustomSelector((state: $ReduxCoreType) => {
    const show_close_button = state.Hello?.[chatSessionId]?.helloConfig?.show_close_button
    return ({
      isMobileSDK: state.Hello?.[chatSessionId]?.helloConfig?.isMobileSDK || false,
      hideCloseButton: typeof show_close_button === 'boolean' ? !show_close_button : false,
      teams: state.Hello?.[chatSessionId]?.widgetInfo?.teams || [],
      agentTeamName: getAgentTeamName(state, chatSessionId, currentChannelId),
      showNotificationView: state.appInfo?.[tabSessionId]?.showNotificationView || false,
      notificationsCount: (state.Chat?.notifications || []).length
    })
  });
  // Handle fullscreen toggle
  const toggleFullScreen = (enter: boolean) => {
    if (!window?.parent) return;
    const message = enter
      ? { type: "ENTER_FULL_SCREEN_CHATBOT" }
      : { type: "EXIT_FULL_SCREEN_CHATBOT" };

    window.parent.postMessage(message, "*");
  };

  // Close chatbot handler
  const handleCloseChatbot = (e: any) => {
    e.stopPropagation();
    if (!window?.parent) return;
    window.parent.postMessage({ type: "CLOSE_CHATBOT" }, "*");
  };

  // Set team name when teams or currentTeamId changes.
  // When currentTeamId is empty (e.g. a fresh notification-triggered chat),
  // reset teamName so the header falls back to "Conversation" instead of
  // showing the previously selected team's name.
  useEffect(() => {
    if (!teams?.length || !currentTeamId) {
      setTeamName(false);
      return;
    }

    const team = teams.find((item: any) => item?.id === currentTeamId);
    setTeamName(team ? team.name : false);
  }, [teams, currentTeamId]);

  // Memoized drawer toggle button
  const hasUnreadIndicator = (unreadNotifications || 0) > 0 || (unreadTotalMsgs || 0) > 0;

  const DrawerToggleButton = useMemo(() => {
    return (
      //p-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]
      <button
        className="relative p-2 rounded-full transition-colors text-current hover:bg-gray-200"
        onClick={() => setToggleDrawer(!isToggledrawer)}
      >
        {isToggledrawer ? null : <AlignLeft size={22} />}
        {!isToggledrawer && hasUnreadIndicator && (
          <span
            aria-label="New notifications"
            className="absolute top-1 right-1 block w-2.5 h-2.5 rounded-full bg-[var(--error-color,#ef4444)] border-2 border-[var(--background,#fff)] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
          />
        )}
      </button>
    );
  }, [isToggledrawer, setToggleDrawer, hasUnreadIndicator]);

  // Memoized header title section
  const HeaderTitleSection = useMemo(() => {
    const isNotificationActive = showNotificationView && notificationsCount > 0;
    const displayTitle = isNotificationActive ? 'Notifications' : (isChatbotMinimized && lastMessage?.role === 'user' ? 'You' : (agentTeamName || teamName || "Conversation"));

    // Minimized version of the header
    const MinimizedHeaderTitle = () => (
      <div className="flex flex-col items-center mx-auto">
        <div className="flex items-center sm:gap-3 gap-1 justify-center relative">
          <div className="flex items-center">
            <div className="relative">
              <h1 className="text-center font-semibold whitespace-nowrap overflow-hidden overflow-ellipsis text-sm max-w-80">
                {displayTitle}
              </h1>
              {unReadCount > 0 && (
                <sup className="absolute -top-3 -right-3 text-[10px] min-w-[16px] h-[16px] px-1 bg-red-500 text-white font-bold rounded-full flex items-center justify-center shadow-md">
                  {unReadCount}
                </sup>
              )}
            </div>
            {lastMessage && (
              <div className="flex items-center gap-1">
                <p>:</p>
                <div className="line-clamp-1 text-sm md:text-base">{(() => {
                  if (lastMessage?.message_type === 'pushNotification') return "Custom Notification";
                  const raw = lastMessage.messageJson?.text
                    || (lastMessage.messageJson?.attachment?.length > 0 ? "Attachment"
                      : lastMessage.messageJson?.message_type || "New conversation");
                  if (typeof document === 'undefined') return raw;
                  const tmp = document.createElement('div');
                  tmp.innerHTML = raw || '';
                  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim() || 'New conversation';
                })()}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    // Full-size version of the header
    const FullSizeHeaderTitle = () => (
      <div className="flex flex-col items-center mx-auto">
        <div className="flex items-center sm:gap-3 gap-1 justify-center relative">
          <div className="flex items-center">
            <div className="relative">
              <h1 className="text-center font-semibold whitespace-nowrap overflow-hidden overflow-ellipsis text-base">
                {displayTitle}
              </h1>
            </div>
          </div>
        </div>
      </div>
    );

    return isChatbotMinimized ? <MinimizedHeaderTitle /> : <FullSizeHeaderTitle />;
  }, [
    teamName,
    agentTeamName,
    isChatbotMinimized,
    lastMessage,
    unReadCount,
    showNotificationView,
    notificationsCount
  ]);

  // Memoized fullscreen toggle button
  const ScreenSizeToggleButton = useMemo(() => {
    if (isMobileSDK) {
      return null;
    }

    return fullScreen ? (
      <div
        className="cursor-pointer p-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]"
        onClick={() => toggleFullScreen(false)}
      >
        {/* <PictureInPicture2 size={22} color="var(--icon-color)" /> */}
        <Minimize2 size={22} style={{ transform: 'rotate(90deg)' }} />
      </div>
    ) : (
      <div
        className="cursor-pointer p-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]"
        onClick={() => toggleFullScreen(true)}
      >
        {/* <Maximize size={22} color="var(--icon-color)" /> */}
        <Maximize2 size={22} style={{ transform: 'rotate(90deg)' }} />
      </div>
    );
  }, [isMobileSDK, fullScreen, toggleFullScreen]);

  // Memoized close button
  const CloseButton = useMemo(() => {
    if (hideCloseButton === true || hideCloseButton === "true") return null;

    return (
      <div
        className="cursor-pointer p-2 py-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]"
        onClick={handleCloseChatbot}
      >
        <X size={22} />
      </div>
    );
  }, [hideCloseButton, handleCloseChatbot]);

  const handleToggleMinimize = () => {
    if (!isChatbotMinimized && fullScreen) {
      toggleFullScreen(false)
    }
    handleMinimizeChatbot(!isChatbotMinimized)
    if (!isChatbotMinimized) {
      emitEventToParent('MINIMIZE_CHATBOT')
    } else {
      toggleFullScreen(false)
    }
  }

  const MinimizeButton = useMemo(() => {
    return (
      <div
        className="cursor-pointer p-2 py-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]"
        onClick={handleToggleMinimize}
      >
        {isChatbotMinimized ? <Maximize2 size={22} style={{ transform: 'rotate(90deg)' }} /> : <Minus size={22} />}
      </div>
    );
  }, [isChatbotMinimized, fullScreen, toggleFullScreen])

  // Expand button for the collapsed header — un-minimizes the chat back to default size
  const ExpandButton = useMemo(() => {
    if (!isChatbotMinimized) return null;
    return (
      <div
        className="cursor-pointer p-2 rounded-full transition-colors text-current hover:bg-[var(--header-hover-bg,rgba(0,0,0,0.12))]"
        onClick={(e) => { e.stopPropagation(); handleToggleMinimize(); }}
      >
        <Maximize2 size={22} style={{ transform: 'rotate(90deg)' }} />
      </div>
    );
  }, [isChatbotMinimized, handleToggleMinimize])

  // Determine which quick-action items are available
  const hasMinimizeAction = !!MinimizeButton;
  const hasFullScreenAction = !!ScreenSizeToggleButton && !isFullScreen;
  const hasExitFullScreenAction = !!ScreenSizeToggleButton && isFullScreen;

  const showQuickActions = (
    hasMinimizeAction ||
    hasFullScreenAction ||
    hasExitFullScreenAction
  );

  const QuickActionsMenuComponent = useMemo(() => (
    <QuickActionsMenu
      isChatbotMinimized={isChatbotMinimized}
      fullScreen={fullScreen}
      showMinimize={hasMinimizeAction}
      showFullScreen={!isOpenInParentContainer && (hasFullScreenAction || hasExitFullScreenAction)}
      onMinimize={handleToggleMinimize}
      onToggleFullScreen={() => toggleFullScreen(!fullScreen)}
      position={isChatbotMinimized ? 'top' : 'bottom'}
      triggerHoverBg={headerHoverBg}
    />
  ), [
    isChatbotMinimized,
    fullScreen,
    hasMinimizeAction,
    hasFullScreenAction,
    hasExitFullScreenAction,
    handleToggleMinimize,
    toggleFullScreen,
    headerHoverBg,
  ])

  return isChatbotMinimized ?
    <HeaderColorWrapper>
      <div className="px-2 sm:py-4 py-3 w-full cursor-pointer" onClick={handleToggleMinimize}>
        <div className="flex items-center w-full relative px-2">
          <div className="justify-start">
            {HeaderTitleSection}
          </div>
          <div className="flex justify-end items-center gap-1 flex-1 sm:absolute sm:right-0">
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              {ExpandButton}
              {CloseButton}
            </div>
          </div>
        </div>
      </div>
    </HeaderColorWrapper>
    :
    <HeaderColorWrapper>
      <div className="px-2 sm:py-4 py-3 w-full">
        <div className="flex items-center w-full relative">
          {/* Left side buttons */}
          <div className="flex items-center flex-1 sm:absolute sm:left-0 sm:flex sm:items-center">
            {DrawerToggleButton}
          </div>

          {/* Center title section */}
          <div className="flex justify-center items-center flex-1">
            {HeaderTitleSection}
          </div>

          {/* Right side buttons */}
          <div className="flex justify-end items-center gap-1 flex-1 sm:absolute sm:right-0">
            {!isFullScreen && (
            <>
                {showQuickActions && (
                  <div className="flex items-center">
                    {QuickActionsMenuComponent}
                  </div>
                )}
                {CloseButton}
              </>
              )
            }
          </div>
        </div>
      </div>
    </HeaderColorWrapper>
};

export default React.memo(addUrlDataHoc(ChatbotHeader, [ParamsEnums.currentTeamId, ParamsEnums.currentChannelId]));