// hooks/useChatActions.ts
import { errorToast } from '@/components/customToast';
import { getAllThreadsApi, getPreviousMessage, sendDataToAction, sendFeedbackAction } from '@/config/api';
import { removeMessages, setChatsLoading, setData, setHelloEventMessage, setImages, setInitialMessages, setIsFetching, setLoading, setNewMessage, setOptions, setPaginateMessages, setStarterQuestions, setToggleDrawer, updateLastAssistantMessage, updateSingleMessage } from '@/store/chat/chatSlice';
import { getHelloDetailsStart } from '@/store/hello/helloSlice';
import { setThreads } from '@/store/interface/interfaceSlice';
import { $ReduxCoreType } from '@/types/reduxCore';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { PAGE_SIZE } from '@/utils/enums';
import React, { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { SendMessagePayloadType } from './chatTypes';

export const useChatActions = ({ messageRef, timeoutIdRef, chatSessionId, tabSessionId }: { messageRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, timeoutIdRef: React.RefObject<NodeJS.Timeout | null>, chatSessionId: string, tabSessionId: string }) => {
    const globalDispatch = useDispatch();
    const { threadId, subThreadId, bridgeName, variables, selectedAiServiceAndModal, userId, isHelloUser, firstThread, versionId = 'null' } = useCustomSelector((state: $ReduxCoreType) => ({
        threadId: state.appInfo?.[tabSessionId]?.threadId,
        subThreadId: state.appInfo?.[tabSessionId]?.subThreadId,
        bridgeName: state.appInfo?.[tabSessionId]?.bridgeName,
        versionId: state.appInfo?.[tabSessionId]?.versionId || "null",
        variables: state.Interface?.[chatSessionId]?.interfaceContext?.[state?.appInfo?.[tabSessionId]?.bridgeName]?.variables,
        selectedAiServiceAndModal: state.Interface?.[chatSessionId]?.selectedAiServiceAndModal || null,
        userId: state.appInfo?.[tabSessionId]?.userId || null,
        isHelloUser: state.Hello?.[chatSessionId]?.isHelloUser || false,
        firstThread: state.Interface?.[chatSessionId]?.interfaceContext?.[state.appInfo?.[tabSessionId]?.bridgeName]?.threadList?.[state.appInfo?.[tabSessionId]?.threadId]?.[0]
    }))

    const { isFetching, hasMoreMessages, currentPage, images, msgIdAndDataMap, loading } = useCustomSelector((state) => ({
        isFetching: state.Chat.isFetching,
        hasMoreMessages: state.Chat.hasMoreMessages,
        currentPage: state.Chat.currentPage,
        images: state.Chat.images || [],
        msgIdAndDataMap: state.Chat.msgIdAndDataMap?.[subThreadId] || {},
        loading: state.Chat.loading || false,
    }))

    useEffect(() => {
        if (bridgeName) {
            globalDispatch(getHelloDetailsStart({ slugName: bridgeName }));
        }
    }, [bridgeName, chatSessionId])

    useEffect(() => {
        threadId && bridgeName && fetchAllThreads()
    }, [threadId, bridgeName, chatSessionId]);

    useEffect(() => {
        if (!(firstThread?.newChat && firstThread?.subThread_id === subThreadId)) {
            getIntialChatHistory();
        }
    }, [threadId, bridgeName, subThreadId]);

    const startTimeoutTimer = () => {
        timeoutIdRef.current = setTimeout(() => {
            globalDispatch(updateLastAssistantMessage({ role: "assistant", wait: false, timeOut: true }));
            globalDispatch(setLoading(false));
        }, 240000);
    };

    const fetchAllThreads = async () => {
        const result = await getAllThreadsApi({ threadId });
        if (result?.success) {
            globalDispatch(
                setThreads({ bridgeName, threadId, threadList: result?.threads })
            );
        }
    }

    const getIntialChatHistory = async () => {
        if (threadId && bridgeName) {
            globalDispatch(setChatsLoading(true));
            try {
                const { previousChats, starterQuestion } = await getPreviousMessage(
                    threadId,
                    bridgeName,
                    1,
                    subThreadId
                );
                if (Array.isArray(previousChats)) {
                    globalDispatch(setInitialMessages({ messages: previousChats }));
                    globalDispatch(setData({
                        currentPage: 1,
                        hasMoreMessages: previousChats?.length >= PAGE_SIZE.gtwy
                    }));
                } else {
                    globalDispatch(setInitialMessages({ messages: [] }));
                    globalDispatch(setData({
                        hasMoreMessages: false
                    }));
                    console.warn("previousChats is not an array");
                }
                if (Array.isArray(starterQuestion)) {
                    globalDispatch(setStarterQuestions(starterQuestion));
                }
            } catch (error) {
                console.warn("Error fetching previous chats:", error);
                // change to globalDispatch
                globalDispatch(setInitialMessages({ messages: [] }));
                globalDispatch(setData({ hasMoreMessages: false }))
            } finally {
                globalDispatch(setChatsLoading(false));
            }
        }
    };

    const getMoreChats = async () => {
        if (isFetching || !hasMoreMessages) return;
        globalDispatch(setIsFetching(true));
        try {

            const nextPage = currentPage + 1;
            const { previousChats } = await getPreviousMessage(
                threadId,
                bridgeName,
                nextPage,
                subThreadId
            );

            if (Array.isArray(previousChats) && previousChats.length > 0) {
                globalDispatch(setPaginateMessages({ messages: [...previousChats] }));
                globalDispatch(setData({
                    currentPage: nextPage,
                    hasMoreMessages: previousChats?.length >= PAGE_SIZE.gtwy
                }));
            } else {
                globalDispatch(setData({
                    hasMoreMessages: false
                }));
            }
        } catch (error) {
            console.warn("Error fetching more messages:", error);
            errorToast("Failed to load more messages.");
        } finally {
            globalDispatch(setIsFetching(false));
        }
    }

    const sendMessage = async ({ message = '', customVariables = {}, customThreadId = '', customBridgeSlug = '', apiCall = true }: SendMessagePayloadType) => {
        globalDispatch(setNewMessage(true));
        const textMessage = message || (messageRef?.current as HTMLInputElement)?.value;
        const imageUrls = Array.isArray(images) && images?.length ? images : []; // Assuming imageUrls is an empty array or you can replace it with the actual value

        if (!textMessage && imageUrls.length === 0) return;
        if (messageRef.current) {
            messageRef.current.value = "";
        }
        globalDispatch(setLoading(true));
        globalDispatch(setOptions([]));
        startTimeoutTimer();

        globalDispatch(setData({
            options: [],
            images: [],
        }));

        globalDispatch(setHelloEventMessage({ message: { role: "user", content: textMessage, urls: imageUrls } }));
        globalDispatch(setHelloEventMessage({ message: { role: "assistant", content: "Talking with AI", wait: true } }));

        const payload = {
            message: textMessage,
            images: imageUrls, // Send image URLs
            userId,
            interfaceContextData: { ...variables, ...customVariables } || {},
            threadId: customThreadId || threadId,
            subThreadId: subThreadId,
            slugName: customBridgeSlug || bridgeName,
            thread_flag: (firstThread?.newChat && firstThread?.sub_thread_id === subThreadId) ? true : false,
            chatBotId: chatSessionId,
            version_id: versionId === "null" ? null : versionId,
            ...((selectedAiServiceAndModal?.modal && selectedAiServiceAndModal?.service) ? {
                configuration: { model: selectedAiServiceAndModal?.modal },
                service: selectedAiServiceAndModal?.service
            } : {})
        }
        const response = await sendDataToAction(payload);
        if (!response?.success) {
            globalDispatch(setLoading(false));
            globalDispatch(removeMessages({ numberOfMessages: 1 }));
            return
        }
    }

    const handleMessageFeedback = async (payload: { msgId: string, feedback: number, reduxMsgId: string }) => {
        const { msgId, feedback, reduxMsgId } = payload;
        const currentStatus = msgIdAndDataMap?.[reduxMsgId]?.user_feedback;
        if (msgId && feedback && currentStatus !== feedback) {
            const response = await sendFeedbackAction({
                messageId: msgId,
                feedbackStatus: feedback,
            });
            if (response?.success) {
                globalDispatch(updateSingleMessage({
                    messageId: msgId,
                    data: { user_feedback: feedback }
                }));
            }
        }
    }

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            if (event?.data?.type === "refresh") {
                getIntialChatHistory();
            }
            if (event?.data?.type === "askAi") {
                if (!loading) {
                    const data = event?.data?.data;
                    if (typeof data === "string") {
                        // this is for when direct sending message through window.askAi("hello")
                        sendMessage({ message: data });
                    } else {
                        // this is for when sending from SendDataToChatbot method window.SendDataToChatbot({bridgeName: 'asdlfj', askAi: "hello"})
                        setTimeout(() => {
                            sendMessage({ message: data.askAi || data?.message || "", customVariables: data?.variables || {}, customThreadId: data?.threadId || null, customBridgeSlug: data?.bridgeName || null });
                        }, 500);

                    }
                } else {
                    errorToast("Please wait for the response from AI");
                    return;
                }
            }
        },
        []
    );

    useEffect(() => {
        if (!isHelloUser) {
            window.addEventListener("message", handleMessage);
            return () => {
                window.removeEventListener("message", handleMessage);
            };
        }
    }, [handleMessage]);

    if (isHelloUser) {
        return {
            fetchAllThreads: () => { },
            getIntialChatHistory: () => { },
            getMoreChats: () => { },
            sendMessage: () => { },
            setToggleDrawer: (payload: boolean) => globalDispatch(setToggleDrawer(payload)),
            setLoading: (payload: boolean) => globalDispatch(setLoading(payload)),
            setChatsLoading: (payload: boolean) => globalDispatch(setChatsLoading(payload)),
            setImages: (payload: string[]) => globalDispatch(setImages(payload)),
            setOptions: (payload: string[]) => globalDispatch(setOptions(payload)),
            setNewMessage: (payload: boolean) => globalDispatch(setNewMessage(payload)),
            handleMessageFeedback: () => { }
        }
    }

    return {
        fetchAllThreads,
        getIntialChatHistory,
        getMoreChats,
        sendMessage,
        setToggleDrawer: (payload: boolean) => globalDispatch(setToggleDrawer(payload)),
        setLoading: (payload: boolean) => globalDispatch(setLoading(payload)),
        setChatsLoading: (payload: boolean) => globalDispatch(setChatsLoading(payload)),
        setImages: (payload: string[]) => globalDispatch(setImages(payload)),
        setOptions: (payload: string[]) => globalDispatch(setOptions(payload)),
        setNewMessage: (payload: boolean) => globalDispatch(setNewMessage(payload)),
        handleMessageFeedback,
    };
}