// Region-aware base URLs, set from the routing-region response. Every call after it
// (widget-info included) and the socket must go to that region.
//
// In-memory only: routing-region runs first on every mount, so the region is always
// re-resolved before any region-locked call — persisting it could only make it stale.

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const env = urlParams.get('env');

const DEFAULT_HELLO_HOST_URL = env !== 'stage'
  ? process.env.NEXT_PUBLIC_MSG91_HOST_URL
  : 'https://stageapi.phone91.com';

const DEFAULT_SOCKET_URL = env !== 'stage'
  ? process.env.NEXT_PUBLIC_SOCKET_URL
  : 'https://stagechat.phone91.com';

let regionUrl = '';
let socketUrl = '';

/** Base URL for Hello REST calls. Resolved per call so a late-arriving region applies. */
export const getHelloHostUrl = (): string => regionUrl || DEFAULT_HELLO_HOST_URL || '';

/** Base URL for the chat socket. Read at connect() time for the same reason. */
export const getSocketUrl = (): string => socketUrl || DEFAULT_SOCKET_URL || '';

/** Record the region. Returns true when either URL changed, so callers can drop a stale socket. */
export const setRegionUrls = (nextRegionUrl?: string | null, nextSocketUrl?: string | null): boolean => {
  let changed = false;

  if (nextRegionUrl && nextRegionUrl !== regionUrl) {
    regionUrl = nextRegionUrl;
    changed = true;
  }

  if (nextSocketUrl && nextSocketUrl !== socketUrl) {
    socketUrl = nextSocketUrl;
    changed = true;
  }

  return changed;
};
