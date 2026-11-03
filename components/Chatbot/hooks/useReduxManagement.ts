import { $ReduxCoreType } from '@/types/reduxCore';
import { useCustomSelector } from '@/utils/deepCheckSelector';

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

  // Get Redux state
  const {
    uuid,
    unique_id,
    presence_channel,
    team_id,
    chat_id,
    channelId,
    unique_id_hello,
    widgetToken,
    currentChatId,
    currentChannelId,
    currentTeamId,
    isDefaultNavigateToChatScreen,
    overrideChannelId
  } = useCustomSelector((state) => ({
    uuid: state.Hello?.[chatSessionId]?.channelListData?.uuid,
    unique_id: state.Hello?.[chatSessionId]?.channelListData?.unique_id,
    presence_channel: state.Hello?.[chatSessionId]?.channelListData?.presence_channel,
    team_id: state.Hello?.[chatSessionId]?.widgetInfo?.team?.[0]?.id,
    isDefaultNavigateToChatScreen: isDefaultNavigateToChatScreenFn(state, chatSessionId),
    chat_id: state.Hello?.[chatSessionId]?.Channel?.id,
    channelId: state.Hello?.[chatSessionId]?.Channel?.channel || null,
    unique_id_hello: state?.Hello?.[chatSessionId]?.helloConfig?.unique_id,
    widgetToken: state?.Hello?.[chatSessionId]?.helloConfig?.widgetToken,
    currentChatId: state?.appInfo?.[tabSessionId]?.currentChatId,
    currentChannelId: state?.appInfo?.[tabSessionId]?.currentChannelId,
    currentTeamId: state?.appInfo?.[tabSessionId]?.currentTeamId,
    overrideChannelId: state?.appInfo?.[tabSessionId]?.overrideChannelId,
  }));

  return {
    uuid,
    unique_id,
    presence_channel,
    team_id,
    isDefaultNavigateToChatScreen,
    chat_id,
    channelId,
    unique_id_hello,
    widgetToken,
    currentChatId,
    currentChannelId,
    currentTeamId,
    overrideChannelId
  };
};