/* eslint-disable */
import { getFullMessageApi } from "@/config/helloApi";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { Loader2 } from "lucide-react";
import React, { useCallback, useState } from "react";

/**
 * Wraps a truncated message preview with a "Read more" / "Read less" control.
 *
 * The backend delivers long messages as a preview flagged with show_more; the
 * full body is fetched on demand (by channel + message_id) only when the user
 * expands. State is per-instance and client-side only:
 *   - collapsed: showing the preview with a "Read more" control
 *   - loading:   fetch in flight; control disabled with a spinner
 *   - expanded:  full text shown with a "Read less" control
 *   - error:     fetch failed; preview kept, "Read more" restored for retry
 *
 * Once fetched, the full text is cached in component state so "Read less" →
 * "Read more" re-expands instantly with no second request.
 *
 * `renderContent` lets each caller render text however it normally does
 * (markdown, linkified HTML, plain), so this component stays presentation-agnostic.
 */
function ReadMoreText({
  preview,
  messageId,
  renderContent,
  linkClassName = "text-primary",
}: {
  preview: string;
  messageId: string;
  renderContent: (text: string) => React.ReactNode;
  // Override the control's color so it reads well on colored bubbles.
  linkClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);

  // The active channel is the key the normalized message map is stored under.
  const { channel } = useCustomSelector((state: any) => ({
    channel: state.Chat?.subThreadId,
  }));

  const handleReadMore = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      // Re-expand from cache — no second fetch.
      if (fullText != null) {
        setExpanded(true);
        return;
      }

      if (!channel || !messageId) return;

      setLoading(true);
      const text = await getFullMessageApi(channel, messageId);
      setLoading(false);

      if (text != null) {
        setFullText(text);
        setExpanded(true);
      }
      // On failure getFullMessageApi already surfaces a toast; we keep the
      // preview and leave the "Read more" control in place for retry.
    },
    [channel, messageId, fullText]
  );

  const handleReadLess = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(false);
  }, []);

  return (
    <div>
      {renderContent(expanded && fullText != null ? fullText : preview)}

      {expanded && fullText != null ? (
        <button
          type="button"
          onClick={handleReadLess}
          className={`text-xs font-semibold hover:underline mt-0.5 ${linkClassName}`}
        >
          Read less
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReadMore}
          disabled={loading}
          className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline mt-0.5 disabled:opacity-70 ${linkClassName}`}
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? "Loading…" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default React.memo(ReadMoreText);
