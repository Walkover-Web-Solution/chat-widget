import { safeLocalStorage, safeSessionStorage } from "./safeStorage";

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

// redux-persist adapter over safeStorage: real storage first, in-memory fallback
// when the browser blocks it (e.g. cross-origin iframe in WhatsApp's iOS webview).
const createSafeWebStorage = (
  backend: typeof safeLocalStorage | typeof safeSessionStorage
): Storage => ({
  getItem: (key: string) => Promise.resolve(backend.getItem(key)),
  setItem: (key: string, value: any) => {
    backend.setItem(key, value);
    return Promise.resolve(value);
  },
  removeItem: (key: string) => {
    backend.removeItem(key);
    return Promise.resolve();
  },
});

const createStorage = () => {
  if (typeof window === "undefined") {
    return { local: createNoopStorage(), session: createNoopStorage() };
  }
  return {
    local: createSafeWebStorage(safeLocalStorage),
    session: createSafeWebStorage(safeSessionStorage),
  };
};

export const STORAGE_OPTIONS = createStorage();
