import { safeLocalStorage, safeSessionStorage } from "./safeStorage";

/**
 * Session keys that must survive an iframe document reload.
 *
 * sessionStorage is per browsing context. In in-app browsers (WhatsApp /
 * Instagram on iOS) the cross-origin widget iframe can be silently reloaded,
 * which empties sessionStorage while localStorage (and the redux state persisted
 * in it) survives. `widgetToken` is the prefix for every localStorage key, so
 * losing it made getLocalStorage read the wrong keys and send `null:null`.
 * These keys are therefore mirrored to localStorage and read back from there.
 */
const SESSION_KEYS_BACKED_BY_LOCAL = new Set(["widgetToken"]);
const localBackupKey = (key: string) => `__session_backup_${key}`;

export const SetSessionStorage = (key: string, value: string) => {
  try {
    safeSessionStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting session storage data for key "${key}":`, { error });
  }
  if (SESSION_KEYS_BACKED_BY_LOCAL.has(key)) {
    try {
      safeLocalStorage.setItem(localBackupKey(key), value);
    } catch { /* ignore */ }
  }
};

export const GetSessionStorageData = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = safeSessionStorage.getItem(key);
    if (value !== null) return value;
    if (SESSION_KEYS_BACKED_BY_LOCAL.has(key)) {
      const backup = safeLocalStorage.getItem(localBackupKey(key));
      if (backup !== null) {
        safeSessionStorage.setItem(key, backup);
        return backup;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving session storage data for key "${key}":`, { error });
    return null;
  }
};
