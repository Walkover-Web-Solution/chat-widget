/* eslint-disable */
/**
 * Single source of truth for the "Read more / Read less" truncation contract.
 *
 * The backend delivers long messages truncated to a preview and marks them with
 * a boolean flag. The full body is fetched on demand from /get-history/ keyed by
 * channel + message_id (see getFullMessageApi in config/helloApi.ts).
 *
 * NOTE: The backend flag name is not yet confirmed. The original spec referenced
 * both `show_more` and `truncated`. We assume `show_more` for now; if the backend
 * confirms a different name, change SHOW_MORE_FIELD (and add to SHOW_MORE_ALIASES)
 * here — no other file needs to change.
 */

// The canonical flag name on the raw message payload / normalized message.
export const SHOW_MORE_FIELD = "show_more";

// Alias field names to also treat as the truncation flag, for backend variance.
// `truncated` is included because the original spec referenced it alongside show_more.
const SHOW_MORE_ALIASES = [SHOW_MORE_FIELD] as const;

/**
 * True when a message is a server-truncated preview that has more content to fetch.
 * Reads the canonical flag and known aliases; tolerant of the flag living either
 * on the raw payload's `content` object or on the normalized message.
 */
export function hasMoreContent(source: any): boolean {
  if (!source) return false;
  return SHOW_MORE_ALIASES.some((field) => source?.[field] === true);
}

/**
 * Extract the truncation flag from a raw Hello payload's `content` object
 * (or any object carrying it), normalizing to a single boolean field.
 */
export function readShowMore(content: any): boolean {
  return hasMoreContent(content);
}

/**
 * Pull the full message text out of the full-message response.
 * Response shape: { message: { text, attachment } }.
 */
export function extractFullMessageText(response: any): string | null {
  const text = response?.message?.text;
  return typeof text === "string" ? text : null;
}
