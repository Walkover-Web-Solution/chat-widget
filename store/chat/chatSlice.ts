import { createSlice } from "@reduxjs/toolkit";
import { chatReducerV2, initialChatState } from "./chatReducerV2";

const chatSlice = createSlice({
    name: "Chat",
    initialState: initialChatState,
    reducers: chatReducerV2
});

export const {
    setLoading,
    setChatsLoading,
    setImages,
    setSubThreadId,
    setNewMessage,
    setToggleDrawer,
    setTyping,
    setData,
    setOpenHelloForm,
    setInitialMessages,
    setPaginateMessages,
    setHelloEventMessage,
    updateHelloMessage,
    addNotification,
    removeNotification,
    setNotifications,
    moveThreadMessages
} = chatSlice.actions;

export default chatSlice.reducer;