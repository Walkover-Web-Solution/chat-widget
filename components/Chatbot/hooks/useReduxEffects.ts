import { setSubThreadId, setToggleDrawer } from '@/store/chat/chatSlice';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useScreenSize } from './useScreenSize';

export const useReduxEffects = ({ tabSessionId }: { tabSessionId: string }) => {
    const dispatch = useDispatch();
    const { isSmallScreen } = useScreenSize();

    const { reduxSubThreadId } = useCustomSelector((state) => ({
        reduxSubThreadId: state.appInfo?.[tabSessionId]?.subThreadId || "",
    }));

    // Sync Redux subThreadId with local state
    useEffect(() => {
        dispatch(setSubThreadId(reduxSubThreadId));
    }, [reduxSubThreadId, dispatch]);

    // Sync large screen toggle with local state
    useEffect(() => {
        dispatch(setToggleDrawer(!isSmallScreen));
    }, [isSmallScreen, dispatch]);

    return null;
}
