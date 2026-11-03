export interface $AppInfoReduxType {
    [tabSessionId: string]: {
        subThreadId: string
        currentChannelId: string,
        currentChatId: string,
        currentTeamId: string,
        overrideChannelId?: string,
        isChatbotOpen: boolean,
        callToken: string,
        demoSessionId?: string,
        showNotificationView?: boolean,
    }
}