import { emitEventToParent } from "./emitEventsToParent/emitEventsToParent";

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
    sessionStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting session storage data for key "${key}":`, { error });
  }
  if (SESSION_KEYS_BACKED_BY_LOCAL.has(key)) {
    try {
      localStorage.setItem(localBackupKey(key), value);
    } catch { /* ignore */ }
  }
};

export const GetSessionStorageData = (key: string): string | null => {
  if (typeof window === 'undefined') return null; // SSR guard

  try {
    const value = sessionStorage.getItem(key);
    if (value !== null) return value;
    if (SESSION_KEYS_BACKED_BY_LOCAL.has(key)) {
      const backup = localStorage.getItem(localBackupKey(key));
      if (backup !== null) {
        // Restore so later reads in this document hit sessionStorage directly.
        sessionStorage.setItem(key, backup);
        return backup;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving session storage data for key "${key}":`, { error });
    return null;
  }
};

export const isJSONString = (str: string) => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

export const perFormAction = (actionData, sendMessage, props) => {

  switch (actionData?.actionType) {
    case "reply":
      sendMessage({ message: (props?.label || props?.children || props?.text || props?.title || props?.name) });
      break;
    case "sendDataToFrontEnd":
      emitEventToParent(
        'FRONT_END_ACTION',
        actionData?.variables || actionData?.variable || actionData?.data || actionData?.dataToSend || {}
      );
      break;
    default:
      break;
  }
};

export const toggleSidebar = (sidebarId) => {
  const sidebar = document.getElementById(sidebarId);
  const handleClickOutside = (event) => {
    const sidebar = document.getElementById(sidebarId);
    const button = event.target.closest('button');

    if (sidebar && !sidebar.contains(event.target) && !button) {
      sidebar.classList.add('-translate-x-full');
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscPress);
    }
  };

  const handleEscPress = (event) => {
    if (event.key === 'Escape') {
      sidebar.classList.add('-translate-x-full');
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscPress);
    }
  };

  if (sidebar) {
    sidebar.classList.toggle('-translate-x-full');

    if (!sidebar.classList.contains('-translate-x-full')) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscPress);
    } else {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscPress);
    }
  }
};