import { $ReduxCoreType } from '@/types/reduxCore';
import { useCustomSelector } from '@/utils/deepCheckSelector';
<<<<<<< Updated upstream
import { useMediaQuery, useTheme } from '@mui/material';
import { useEffect } from 'react';
=======
>>>>>>> Stashed changes

function isDefaultNavigateToChatScreenFn(state: $ReduxCoreType, chatSessionId: string) {
  const teams = state.Hello?.[chatSessionId]?.widgetInfo?.teams || [];
  const channels = state.Hello?.[chatSessionId]?.channelListData?.channels || [];
  return teams && teams.length <= 1 && channels?.length <= 1 && !channels?.[0]?.id;
}

export const useReduxStateManagement = ({
  chatSessionId,
  tabSessionId
}: {
  chatSessionId: string;
  tabSessionId: string;
}) => {
<<<<<<< Updated upstream
  // FIXED: Always call hooks at the top level, in the same order
  const dispatch = useAppDispatch();
  const isLargeScreen = useMediaQuery('(max-width: 1024px)');
  const isSmallScreen = useMediaQuery('(max-width: 1023px)');
=======
>>>>>>> Stashed changes

  // Get Redux state
  const {
    interfaceContextData,
    isHelloUser,
    uuid,
    unique_id,
    presence_channel,
    team_id,
    chat_id,
    channelId,
    mode,
    selectedAiServiceAndModal,
    unique_id_hello,
    widgetToken,
    currentChatId,
    currentChannelId,
    currentTeamId,
    isDefaultNavigateToChatScreen
  } = useCustomSelector((state) => ({
    interfaceContextData: state.Interface?.[chatSessionId]?.interfaceContext?.variables,
    isHelloUser: state.Hello?.[chatSessionId]?.isHelloUser || false,
    uuid: state.Hello?.[chatSessionId]?.channelListData?.uuid,
    unique_id: state.Hello?.[chatSessionId]?.channelListData?.unique_id,
    presence_channel: state.Hello?.[chatSessionId]?.channelListData?.presence_channel,
    team_id: state.Hello?.[chatSessionId]?.widgetInfo?.team?.[0]?.id,
    isDefaultNavigateToChatScreen: isDefaultNavigateToChatScreenFn(state, chatSessionId),
    chat_id: state.Hello?.[chatSessionId]?.Channel?.id,
    channelId: state.Hello?.[chatSessionId]?.Channel?.channel || null,
    mode: state.Hello?.[chatSessionId]?.mode || [],
    selectedAiServiceAndModal: state.Interface?.[chatSessionId]?.selectedAiServiceAndModal || null,
    unique_id_hello: state?.Hello?.[chatSessionId]?.helloConfig?.unique_id,
    widgetToken: state?.Hello?.[chatSessionId]?.helloConfig?.widgetToken,
    currentChatId: state?.appInfo?.[tabSessionId]?.currentChatId,
    currentChannelId: state?.appInfo?.[tabSessionId]?.currentChannelId,
    currentTeamId: state?.appInfo?.[tabSessionId]?.currentTeamId,
  }));

<<<<<<< Updated upstream
  // Sync Redux threadId with local state
  useEffect(() => {
    dispatch(setThreadId(reduxThreadId));
  }, [reduxThreadId, dispatch]);

  // Sync Redux subThreadId with local state
  useEffect(() => {
    dispatch(setSubThreadId(reduxSubThreadId));
  }, [reduxSubThreadId, dispatch]);

  // Sync Redux bridgeName with local state
  useEffect(() => {
    dispatch(setBridgeName(reduxBridgeName));
  }, [reduxBridgeName, dispatch]);

  // Sync Redux headerButtons with local state
  useEffect(() => {
    dispatch(setHeaderButtons(reduxHeaderButtons));
  }, [reduxHeaderButtons, dispatch]);

  // Sync Redux helloId with local state
  useEffect(() => {
    dispatch(setHelloId(reduxHelloId));
  }, [reduxHelloId, dispatch]);

  // Sync Redux bridgeVersionId with local state
  useEffect(() => {
    dispatch(setBridgeVersionId(reduxBridgeVersionId));
  }, [reduxBridgeVersionId, dispatch]);

  // Sync isHelloUser with local state
  useEffect(() => {
    dispatch(setData({ isHelloUser }))
  }, [isHelloUser, dispatch]);

  // Sync large screen toggle with local state
  useEffect(() => {
    dispatch(setToggleDrawer(!isLargeScreen));
  }, [isLargeScreen, dispatch]);
=======
>>>>>>> Stashed changes

  return {
    interfaceContextData,
    isHelloUser,
    uuid,
    unique_id,
    presence_channel,
    team_id,
    isDefaultNavigateToChatScreen,
    chat_id,
    channelId,
    mode,
    selectedAiServiceAndModal,
    unique_id_hello,
    widgetToken,
    currentChatId,
    currentChannelId,
    currentTeamId,
    isSmallScreen
  };
};