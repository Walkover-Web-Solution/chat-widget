/**
 * Runtime logger for socket / realtime traffic.
 * Only active when NODE_ENV !== 'production'.
 * Safe to import & call in any environment — installs nothing when disabled.
 */

type Frame = {
  ts: number;
  direction: 'in' | 'out' | 'system';
  kind: 'ws' | 'sse' | 'xhr' | 'fetch' | 'pubnub' | 'parent-post' | 'parent-receive';
  url?: string;
  raw: any;
  parsed?: any;
};

declare global {
  interface Window {
    __socketLogger?: {
      history: Frame[];
      clear: () => void;
      uninstall: () => void;
    };
  }
}

const NS = '%c[socket]';
const NS_STYLE = 'color:#2563eb;font-weight:600;';

const isProd =
  typeof process !== 'undefined' && process?.env?.NODE_ENV === 'production';

function safeParse(s: any): any {
  if (typeof s !== 'string') return undefined;
  try { return JSON.parse(s); } catch { return s; }
}

function push(frame: Frame) {
  if (!window.__socketLogger) return;
  window.__socketLogger.history.push(frame);
  if (window.__socketLogger.history.length > 500) {
    window.__socketLogger.history.shift();
  }
}

function log(frame: Frame) {
  push(frame);
  const tag = `${NS} ${frame.direction.toUpperCase()} ${frame.kind} ${frame.url ? '→ ' + frame.url : ''}`;
  if (frame.parsed !== undefined) {
    console.log(tag, NS_STYLE, frame.parsed);
  } else {
    console.log(tag, NS_STYLE, frame.raw);
  }
}

export function installSocketLogger() {
  if (typeof window === 'undefined') return;
  if (isProd) return; // disabled in production
  if (window.__socketLogger) return; // already installed

  // Keep references for full uninstall (useful in tests / HMR).
  const OrigWS = window.WebSocket;
  const OrigES = window.EventSource;
  const OrigFetch = window.fetch;
  const OrigXHR = window.XMLHttpRequest;

  window.__socketLogger = {
    history: [],
    clear: () => {
      window.__socketLogger!.history = [];
      console.clear();
    },
    uninstall: () => {
      // @ts-ignore
      window.WebSocket = OrigWS;
      // @ts-ignore
      window.EventSource = OrigES;
      window.fetch = OrigFetch;
      // @ts-ignore
      window.XMLHttpRequest = OrigXHR;
      delete window.__socketLogger;
    },
  };

  // ---------- WebSocket ----------
  class WrappedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols as any);
      const urlStr = String(url);
      log({ ts: Date.now(), direction: 'system', kind: 'ws', url: urlStr, raw: 'OPEN' });
      this.addEventListener('message', (e: MessageEvent) => {
        log({
          ts: Date.now(), direction: 'in', kind: 'ws', url: urlStr,
          raw: e.data, parsed: safeParse(e.data),
        });
      });
      const origSend = this.send.bind(this);
      this.send = (data: any) => {
        log({
          ts: Date.now(), direction: 'out', kind: 'ws', url: urlStr,
          raw: data, parsed: safeParse(data),
        });
        return origSend(data);
      };
      this.addEventListener('close', (e) => {
        log({ ts: Date.now(), direction: 'system', kind: 'ws', url: urlStr, raw: `CLOSE ${e.code}` });
      });
      this.addEventListener('error', (e) => {
        log({ ts: Date.now(), direction: 'system', kind: 'ws', url: urlStr, raw: e });
      });
    }
  }
  // @ts-ignore
  window.WebSocket = WrappedWS;

  // ---------- EventSource (SSE) ----------
  if (OrigES) {
    class WrappedES extends OrigES {
      constructor(url: string, conf?: EventSourceInit) {
        super(url, conf);
        const urlStr = String(url);
        log({ ts: Date.now(), direction: 'system', kind: 'sse', url: urlStr, raw: 'OPEN' });
        ['message', 'error', 'open'].forEach((evt) => {
          this.addEventListener(evt, (e: any) => {
            log({
              ts: Date.now(),
              direction: evt === 'message' ? 'in' : 'system',
              kind: 'sse', url: urlStr,
              raw: e?.data ?? e?.type, parsed: safeParse(e?.data),
            });
          });
        });
      }
    }
    // @ts-ignore
    window.EventSource = WrappedES;
  }

  // ---------- fetch ----------
  window.fetch = async (...args: any[]) => {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : (input as Request).url;
    log({ ts: Date.now(), direction: 'out', kind: 'fetch', url, raw: { method: (init?.method || 'GET'), body: init?.body } });
    const res = await OrigFetch(...args);
    const clone = res.clone();
    clone.text().then((t) => {
      log({
        ts: Date.now(), direction: 'in', kind: 'fetch', url,
        raw: { status: res.status, body: t.slice(0, 4000) },
        parsed: safeParse(t),
      });
    }).catch(() => {});
    return res;
  };

  // ---------- XMLHttpRequest ----------
  class WrappedXHR extends OrigXHR {
    private _url = '';
    private _method = '';
    open(method: string, url: string | URL, ...rest: any[]) {
      this._method = method;
      this._url = String(url);
      return super.open(method, url as any, ...rest);
    }
    send(body?: any) {
      log({ ts: Date.now(), direction: 'out', kind: 'xhr', url: this._url, raw: { method: this._method, body } });
      this.addEventListener('load', () => {
        log({
          ts: Date.now(), direction: 'in', kind: 'xhr', url: this._url,
          raw: { status: this.status, body: (this.responseText || '').slice(0, 4000) },
          parsed: safeParse(this.responseText),
        });
      });
      return super.send(body);
    }
  }
  // @ts-ignore
  window.XMLHttpRequest = WrappedXHR;

  // ---------- axios (if loaded) ----------
  // axios uses XHR under the hood, but if a project swaps in a custom adapter
  // (e.g. http adapter in Node tests), we still want a hook. We patch lazily on
  // first axios import and re-apply wrappers.
  const tryPatchAxios = () => {
    const ax = (window as any).axios;
    if (!ax || (ax as any).__socketLoggerPatched) return;
    try {
      ax.interceptors.request.use((req: any) => {
        log({
          ts: Date.now(), direction: 'out', kind: 'fetch',
          url: req?.url, raw: { method: req?.method, data: req?.data },
        });
        return req;
      });
      ax.interceptors.response.use(
        (res: any) => {
          log({
            ts: Date.now(), direction: 'in', kind: 'fetch',
            url: res?.config?.url,
            raw: { status: res?.status, data: typeof res?.data === 'string' ? res.data.slice(0, 4000) : '<non-string>' },
            parsed: typeof res?.data === 'string' ? safeParse(res.data) : undefined,
          });
          return res;
        },
        (err: any) => {
          log({
            ts: Date.now(), direction: 'in', kind: 'fetch',
            url: err?.config?.url, raw: { status: err?.response?.status, error: err?.message },
          });
          return Promise.reject(err);
        },
      );
      (ax as any).__socketLoggerPatched = true;
    } catch { /* axios missing — ignore */ }
  };
  tryPatchAxios();
  // Re-attempt in case axios is loaded async.
  setTimeout(tryPatchAxios, 0);
  setTimeout(tryPatchAxios, 1000);

  // ---------- parent ↔ iframe postMessage ----------
  try {
    const origPost = window.parent.postMessage.bind(window.parent);
    (window.parent as any).postMessage = function (msg: any, targetOrigin: string, ...rest: any[]) {
      log({ ts: Date.now(), direction: 'out', kind: 'parent-post', raw: msg, parsed: safeParse(msg) });
      return origPost(msg, targetOrigin, ...rest);
    };
  } catch { /* cross-origin parent */ }

  window.addEventListener('message', (e: MessageEvent) => {
    log({
      ts: Date.now(), direction: 'in', kind: 'parent-receive',
      raw: e.data, parsed: safeParse(e.data),
    });
  });

  console.log(
    '%c[socket]%c Socket logger installed (dev only) — watching ws / sse / fetch / xhr / postMessage. window.__socketLogger.history / .clear() / .uninstall()',
    NS_STYLE, 'color:inherit'
  );
  // Heartbeat — proves the iframe is alive in case pages spam the console.
  console.log('[socket] ready @', new Date().toISOString());
}
