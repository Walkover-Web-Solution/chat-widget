import { GetSessionStorageData } from "@/utils/ChatbotUtility";
import createWebStorage from "redux-persist/es/storage/createWebStorage";

type Storage = {
  getItem: (key: string) => Promise<any>;
  setItem: (key: string, value: any) => Promise<any>;
  removeItem: (key: string) => Promise<void>;
};

export const createNoopStorage = (): Storage => ({
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, value: any) => Promise.resolve(value),
  removeItem: (_key: string) => Promise.resolve(),
});

/** Same prefix pattern as setLocalStorage / getLocalStorage. */
export const createWidgetScopedLocalStorage = (): Storage => {
  if (typeof window === "undefined") return createNoopStorage();
  const base = createWebStorage("local");
  const scopeKey = (key: string) => {
    const widgetToken = GetSessionStorageData("widgetToken");
    return widgetToken ? `${widgetToken}_${key}` : key;
  };
  return {
    getItem: (key: string) => base.getItem(scopeKey(key)),
    setItem: (key: string, value: any) => {
      const widgetToken = GetSessionStorageData("widgetToken");
      if (!widgetToken) return Promise.resolve(value);
      return base.setItem(`${widgetToken}_${key}`, value);
    },
    removeItem: (key: string) => base.removeItem(scopeKey(key)),
  };
};

const createStorage = () => {
  if (typeof window === "undefined") return createNoopStorage();
  return {
    local: createWebStorage("local"),
    session: createWebStorage("session"),
  };
};

export const STORAGE_OPTIONS = createStorage();