/**
 * App storage for the chat widget.
 *
 * Uses localStorage/sessionStorage when available, and keeps an in-memory copy
 * so reads still work in WebViews that block or drop storage writes
 * (e.g. WhatsApp / Instagram on iOS).
 */

type Kind = "local" | "session";

const memory: Record<Kind, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

function native(kind: Kind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function createStore(kind: Kind) {
  const mem = memory[kind];

  return {
    getItem(key: string): string | null {
      const store = native(kind);
      if (store) {
        try {
          const value = store.getItem(key);
          if (value !== null) return value;
        } catch { /* use memory */ }
      }
      return mem.get(key) ?? null;
    },

    setItem(key: string, value: string): void {
      mem.set(key, value);
      try {
        native(kind)?.setItem(key, value);
      } catch { /* memory already updated */ }
    },

    removeItem(key: string): void {
      mem.delete(key);
      try {
        native(kind)?.removeItem(key);
      } catch { /* ignore */ }
    },
  };
}

export const localStore = createStore("local");
export const sessionStore = createStore("session");
