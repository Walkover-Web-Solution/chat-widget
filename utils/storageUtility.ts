import { GetSessionStorageData } from "@/utils/ChatbotUtility";
import { localStore, sessionStore } from "./appStorage";

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: any) => Promise<any>;
  removeItem: (key: string) => Promise<void>;
};

export const createNoopStorage = (): Storage => ({
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, value: any) => Promise.resolve(value),
  removeItem: (_key: string) => Promise.resolve(),
});

const toPersistStorage = (store: typeof localStore): Storage => ({
  getItem: (key) => Promise.resolve(store.getItem(key)),
  setItem: (key, value) => {
    store.setItem(key, value);
    return Promise.resolve(value);
  },
  removeItem: (key) => {
    store.removeItem(key);
    return Promise.resolve();
  },
});

/** Same prefix pattern as setLocalStorage / getLocalStorage. */
export const createWidgetScopedLocalStorage = (): Storage => {
  if (typeof window === "undefined") return createNoopStorage();
  const base = toPersistStorage(localStore);
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
  if (typeof window === "undefined") {
    return { local: createNoopStorage(), session: createNoopStorage() };
  }
  return {
    local: toPersistStorage(localStore),
    session: toPersistStorage(sessionStore),
  };
};

export const STORAGE_OPTIONS = createStorage();
