import { $AppInfoReduxType } from "./appInfo/appInfoReduxType";
import { $HelloReduxType } from "./hello/HelloReduxType";

export interface $ReduxCoreType {
  Hello: $HelloReduxType;
  appInfo: $AppInfoReduxType,
  draftData: $DraftDataReducerType
}

export interface $DraftDataReducerType {
  chatSessionId?: string
  tabSessionId?: string
  widgetToken?: string;
  hello: {
    variables: Record<string, any>
  }
  isChatbotMinimized?: boolean;
  prefillInputMessage?: string | null;
}