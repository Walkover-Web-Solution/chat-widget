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
    isDefaultNavigateToChatScreen,
    overrideChannelId,
    companyId
  } = useCustomSelector((state) => {
    const channels = state.Hello?.[chatSessionId]?.channelListData?.channels || [];
    const fallbackChat = (() => {
      if (!channels?.length) return null;
      const openChats = channels
        .filter((ch: any) => !ch.is_closed)
        .sort((a: any, b: any) => (b.last_message?.timetoken || 0) - (a.last_message?.timetoken || 0));
      return openChats[0] || channels[0];
    })();

    // Treat "" / null / undefined as a deliberate "start fresh" signal,
    // not as a fallback trigger. Only fall back when explicitly cleared.
    const isExplicitlyEmpty = (v: any) => v === '' || v === null || v === undefined;
    const appInfoChannelId = state?.appInfo?.[tabSessionId]?.currentChannelId;
    const appInfoChatId = state?.appInfo?.[tabSessionId]?.currentChatId;
    const appInfoTeamId = state?.appInfo?.[tabSessionId]?.currentTeamId;

    return {
      interfaceContextData: state.Interface?.[chatSessionId]?.interfaceContext?.variables,
      isHelloUser: state.draftData?.isHelloUser || false,
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
      currentChannelId: isExplicitlyEmpty(appInfoChannelId)
        ? ''
        : (appInfoChannelId ?? fallbackChat?.channel ?? ''),
      currentChatId: isExplicitlyEmpty(appInfoChatId)
        ? ''
        : (appInfoChatId ?? fallbackChat?.id ?? ''),
      currentTeamId: isExplicitlyEmpty(appInfoTeamId)
        ? ''
        : (appInfoTeamId ?? fallbackChat?.team_id ?? ''),
      overrideChannelId: state?.appInfo?.[tabSessionId]?.overrideChannelId,
      companyId: state.Hello?.[chatSessionId]?.widgetInfo?.company_id || '',
    };
  });

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
    overrideChannelId,
    companyId
  };
};