import { useCustomSelector } from "@/utils/deepCheckSelector";

interface useTabDataProps {
    tabSessionId: string;
}
const useTabData = ({ tabSessionId }: useTabDataProps) => {
    const { subThreadId, currentChannelId, currentChatId, currentTeamId } = useCustomSelector((state) => ({
        subThreadId: state.appInfo?.[tabSessionId]?.subThreadId || '',
        currentChannelId: state.appInfo?.[tabSessionId]?.currentChannelId || '',
        currentChatId: state.appInfo?.[tabSessionId]?.currentChatId || '',
        currentTeamId: state.appInfo?.[tabSessionId]?.currentTeamId || '',
    }));

    return {
        subThreadId,
        currentChannelId,
        currentChatId,
        currentTeamId
    }
};

export default useTabData;
