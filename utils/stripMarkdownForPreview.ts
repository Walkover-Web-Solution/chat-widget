/**
 * Plain-text preview for conversation list subtitles (not full markdown rendering).
 * Strips common markdown markers so list previews don't show raw ** or _ syntax.
 */
export function stripMarkdownForPreview(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalized = text.replace(/<[^>]+>/g, ' ');
  normalized = normalized.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  normalized = normalized.replace(/\*\*([^*]+)\*\*/g, '$1');
  normalized = normalized.replace(/__([^_]+)__/g, '$1');
  normalized = normalized.replace(/\*([^*]+)\*/g, '$1');
  normalized = normalized.replace(/_([^_]+)_/g, '$1');
  normalized = normalized.replace(/`([^`]+)`/g, '$1');
  normalized = normalized.replace(/^#{1,6}\s+/gm, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}