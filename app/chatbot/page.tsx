'use client';
import { setDataInDraftReducer } from "@/store/draftData/draftDataSlice";
import { GetSessionStorageData, SetSessionStorage } from "@/utils/ChatbotUtility";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
export const runtime = "edge";

export default function InterfaceEmbed() {
    const router = useRouter();
    const search = useSearchParams();
    const dispatch = useDispatch();

    useEffect(() => {
        let tabSessionId = GetSessionStorageData('tab_session_id');

        if (!tabSessionId) {
            tabSessionId = Date.now().toString();
            SetSessionStorage('tab_session_id', tabSessionId);
        }

        dispatch(setDataInDraftReducer({ tabSessionId }))

        const environment = search.get("env") === 'stage' ? 'stage' : null;
        router.replace(environment ? `/chatbot/hello?env=${environment}` : `/chatbot/hello`);
    }, [])

    return (
        <div className="h-screen w-full flex items-center justify-center">
            <span className="loading loading-ring loading-lg"></span>
        </div>
    );
}
