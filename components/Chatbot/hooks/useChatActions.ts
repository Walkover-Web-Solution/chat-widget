import { setChatsLoading, setImages, setLoading, setNewMessage, setToggleDrawer } from '@/store/chat/chatSlice';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';

export const useChatActions = () => {
    const globalDispatch = useDispatch();

    return useMemo(() => ({
        setToggleDrawer: (payload: boolean) => globalDispatch(setToggleDrawer(payload)),
        setLoading: (payload: boolean) => globalDispatch(setLoading(payload)),
        setChatsLoading: (payload: boolean) => globalDispatch(setChatsLoading(payload)),
        setImages: (payload: string[]) => globalDispatch(setImages(payload)),
        setNewMessage: (payload: boolean) => globalDispatch(setNewMessage(payload)),
    }), [globalDispatch]);
};
