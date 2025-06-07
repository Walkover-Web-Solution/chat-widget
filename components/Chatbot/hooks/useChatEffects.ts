import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getHelloDetailsStart } from '@/store/hello/helloSlice';
import { useChatActions } from './useChatActions';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { $ReduxCoreType } from '@/types/reduxCore';

export const useChatEffects = (params: Parameters<typeof useChatActions>[0]) => {
    const globalDispatch = useDispatch();
    const { chatSessionId, tabSessionId } = params;
    const actions = useChatActions(params);

    const { threadId, subThreadId, bridgeName, isHelloUser, firstThread } = useCustomSelector((state: $ReduxCoreType) => ({
        threadId: state.appInfo?.[tabSessionId]?.threadId,
        subThreadId: state.appInfo?.[tabSessionId]?.subThreadId,
        bridgeName: state.appInfo?.[tabSessionId]?.bridgeName,
        isHelloUser: state.Hello?.[chatSessionId]?.isHelloUser || false,
        firstThread: state.Interface?.[chatSessionId]?.interfaceContext?.[state.appInfo?.[tabSessionId]?.bridgeName]?.threadList?.[state.appInfo?.[tabSessionId]?.threadId]?.[0]
    }));

    useEffect(() => {
        if (bridgeName) {
            globalDispatch(getHelloDetailsStart({ slugName: bridgeName }));
        }
    }, [bridgeName, chatSessionId]);

    useEffect(() => {
        threadId && bridgeName && actions.fetchAllThreads()
    }, [threadId, bridgeName, chatSessionId]);

    useEffect(() => {
        if (!(firstThread?.newChat && firstThread?.subThread_id === subThreadId)) {
            actions.getIntialChatHistory();
        }
    }, [threadId, bridgeName, subThreadId]);

    useEffect(() => {
        if (!isHelloUser) {
            window.addEventListener("message", actions.handleMessage);
            return () => {
                window.removeEventListener("message", actions.handleMessage);
            };
        }
    }, [actions.handleMessage, isHelloUser]);

    return null;
};