/**
 * Storage wrappers that prefer the real Web Storage APIs but never fail.
 *
 * In some embedded contexts (e.g. WhatsApp / Instagram in-app browsers on iOS,
 * where WKWebView runs with ITP) a cross-origin iframe's localStorage and
 * sessionStorage are blocked: `setItem` throws a SecurityError or the write is
 * silently dropped, and `getItem` returns null. That left the widget sending
 * `Authorization: null:null` and an empty `user_data`.
 *
 * Priority order:
 *   1. Real storage (localStorage / sessionStorage) — always tried first.
 *   2. In-memory mirror — every write is mirrored here; reads fall back to it
 *      when real storage throws or has no value.
 */

type StorageKind = "local" | "session";

const memory: Record<StorageKind, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

const getNativeStorage = (kind: StorageKind): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // Accessing the property itself can throw when storage is blocked.
    return null;
  }
};

const createSafeStorage = (kind: StorageKind) => {
  const mem = memory[kind];

  return {
    getItem(key: string): string | null {
      const native = getNativeStorage(kind);
      if (native) {
        try {
          const value = native.getItem(key);
          if (value !== null) return value;
        } catch {
          /* fall through to memory */
        }
      }
      return mem.has(key) ? (mem.get(key) as string) : null;
    },

    setItem(key: string, value: string): void {
      mem.set(key, value);
      const native = getNativeStorage(kind);
      if (!native) return;
      try {
        native.setItem(key, value);
      } catch {
        /* blocked or quota exceeded — memory copy already saved */
      }
    },

    removeItem(key: string): void {
      mem.delete(key);
      const native = getNativeStorage(kind);
      if (!native) return;
      try {
        native.removeItem(key);
      } catch {
        /* ignore */
      }
    },

    clear(): void {
      mem.clear();
      const native = getNativeStorage(kind);
      if (!native) return;
      try {
        native.clear();
      } catch {
        /* ignore */
      }
    },
  };
};

export const safeLocalStorage = createSafeStorage("local");
export const safeSessionStorage = createSafeStorage("session");
