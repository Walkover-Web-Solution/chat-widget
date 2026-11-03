/* eslint-disable */
import { convertChatHistoryToGenericFormat, convertEventMessageToGenericFormat } from "@/utils/dataConvertWrappers/makeGenericDataFormatUtility";
import { PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
    // Messages and Conversations
    messageIds: Record<string, string[]>;
    msgIdAndDataMap: Record<string, Record<string, any>>;
    // Raw hello messages exactly as received (socket event / local send),
    // newest first, before conversion to the generic render format
    rawHelloMsgList: Record<string, any[]>;
    isTyping: Record<string, any>;

    // Loading States
    loading: boolean;
    chatsLoading: boolean;

    // UI States
    openHelloForm: boolean;
    isToggledrawer: boolean;

    // Chat Metadata
    subThreadId: string;

    // Pagination & Message Handling
    hasMoreMessages: boolean;
    newMessage: boolean;
    skip: number;

    // Media
    images: any[];

    // Notifications
    notifications: Array<{
        id: string;
        content: string;
        timestamp: number;
        read: boolean;
    }>;
}
export const initialChatState: ChatState = {
    // Messages and Conversations
    messageIds: {},
    msgIdAndDataMap: {},
    rawHelloMsgList: {},
    isTyping: {},

    // Loading States
    loading: false,
    chatsLoading: false,

    // UI States
    openHelloForm: false,
    isToggledrawer: false,

    // Chat Metadata
    subThreadId: "",

    // Pagination & Message Handling
    hasMoreMessages: false,
    newMessage: false,
    skip: 1,

    // Media
    images: [],

    // Notifications
    notifications: [],
};

export const chatReducerV2 = {
    setLoading: (state, action: PayloadAction<boolean>) => {
        state.loading = action.payload;
    },

    setChatsLoading: (state, action: PayloadAction<boolean>) => {
        state.chatsLoading = action.payload;
    },

    setImages: (state, action: PayloadAction<any[]>) => {
        state.images = action.payload;
    },

    setSubThreadId: (state, action: PayloadAction<string>) => {
        state.subThreadId = action.payload;
    },

    setNewMessage: (state, action: PayloadAction<boolean>) => {
        state.newMessage = action.payload;
    },

    setToggleDrawer: (state, action: PayloadAction<boolean>) => {
        state.isToggledrawer = action.payload;
    },

    setTyping: (state, action: PayloadAction<{ subThreadId?: string; data: any }>) => {
        const subThreadId = action.payload?.subThreadId || state.subThreadId;
        state.isTyping[subThreadId] = action.payload?.data;
    },

    setData: (state, action: PayloadAction<Partial<ChatState>>) => {
        Object.assign(state, action.payload);
    },

    setOpenHelloForm: (state, action: PayloadAction<boolean>) => {
        state.openHelloForm = action.payload;
    },

    setInitialMessages: (state, action: PayloadAction<{ subThreadId?: string; messages: any[] }>) => {
        const subThreadId = action.payload?.subThreadId || state.subThreadId;
        const messages = convertChatHistoryToGenericFormat(action.payload.messages);

        if (subThreadId) {
            state.messageIds[subThreadId] = messages.map((item) => item.id);
            state.msgIdAndDataMap[subThreadId] = messages.reduce((acc: Record<string, any>, item) => {
                acc[item.id] = item;
                return acc;
            }, {});
        }
    },

    setPaginateMessages: (state, action: PayloadAction<{ subThreadId?: string; messages: any[] }>) => {
        const subThreadId = action.payload?.subThreadId || state.subThreadId;
        const messages = action.payload.messages;
        const messagesArray = convertChatHistoryToGenericFormat(messages);

        if (subThreadId) {
            state.messageIds[subThreadId] = [
                ...(state.messageIds[subThreadId] || []),
                ...messagesArray.map(msg => msg.id)
            ];

            if (!state.msgIdAndDataMap[subThreadId]) {
                state.msgIdAndDataMap[subThreadId] = {};
            }

            Object.assign(
                state.msgIdAndDataMap[subThreadId],
                messagesArray.reduce((acc: Record<string, any>, item) => {
                    acc[item.id] = item;
                    return acc;
                }, {})
            );
        }
    },

    setHelloEventMessage: (state, action: PayloadAction<{ subThreadId?: string; message: any }>) => {
        const subThreadId = action.payload?.subThreadId || state.subThreadId;
        const messagesArray = convertEventMessageToGenericFormat(action.payload.message);

        if (subThreadId) {
            state.rawHelloMsgList[subThreadId] = [
                action.payload.message,
                ...(state.rawHelloMsgList[subThreadId] || [])
            ];
            state.messageIds[subThreadId] = [
                ...messagesArray?.map(msg => msg?.id),
                ...(state.messageIds[subThreadId] || [])
            ];

            if (!state.msgIdAndDataMap[subThreadId]) {
                state.msgIdAndDataMap[subThreadId] = {};
            }

            Object.assign(
                state.msgIdAndDataMap[subThreadId],
                messagesArray.reduce((acc: Record<string, any>, item) => {
                    acc[item.id] = item;
                    return acc;
                }, {})
            );
        }
    },

    updateHelloMessage: (state: any, action: PayloadAction<{ subThreadId?: string; message: any }>) => {
        const subThreadId = action.payload?.subThreadId || state.subThreadId;
        const messagesArray = convertEventMessageToGenericFormat(action.payload.message);
        if (subThreadId) {

            if (!state.msgIdAndDataMap[subThreadId]) {
                state.msgIdAndDataMap[subThreadId] = {};
            }
            const dataMap = state.msgIdAndDataMap[subThreadId];

            Object.assign(
                dataMap,
                messagesArray.reduce((acc: Record<string, any>, item) => {
                    acc[item.id] = item;
                    return acc;
                }, {})
            );
        }
    },

    moveThreadMessages: (state, action: PayloadAction<{ from: string; to: string }>) => {
        const { from, to } = action.payload;
        if (!from || !to || from === to) return;
        state.messageIds[to] = [
            ...(state.messageIds[from] || []),
            ...(state.messageIds[to] || []),
        ];
        state.msgIdAndDataMap[to] = {
            ...(state.msgIdAndDataMap[from] || {}),
            ...(state.msgIdAndDataMap[to] || {}),
        };
        state.rawHelloMsgList[to] = [
            ...(state.rawHelloMsgList[from] || []),
            ...(state.rawHelloMsgList[to] || []),
        ];
        delete state.messageIds[from];
        delete state.msgIdAndDataMap[from];
        delete state.rawHelloMsgList[from];
    },

    // --- Push Notification Reducers ---
    // Push notifications (message_type: "Message") from campaigns are stored here.
    // They appear in the NotificationPage UI and contribute to the launcher badge count.
    addNotification: (state, action: PayloadAction<{ id: string; content: string; timestamp: number }>) => {
        state.notifications = [
            { ...action.payload, read: false },
            ...state.notifications
        ];
    },

    removeNotification: (state, action: PayloadAction<string>) => {
        state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },

    setNotifications: (state, action: PayloadAction<Array<{ id: string; content: string; timestamp: number; read: boolean }>>) => {
        state.notifications = Array.isArray(action.payload) ? action.payload : [];
    },
};
