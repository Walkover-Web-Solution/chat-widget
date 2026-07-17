/* eslint-disable */
import { getFullMessageApi } from "@/config/helloApi";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { Loader2 } from "lucide-react";
import React, { useCallback, useState } from "react";

/**
 * Wraps a truncated message preview with a "Read more" control.
 *
 * The backend delivers long messages as a preview flagged with show_more; the
 * full body is fetched on demand (by channel + message_id) when the user clicks
 * "Read more". Expansion is one-way — once the full text loads it stays shown.
 * State is per-instance and client-side only:
 *   - preview: showing the truncated text with a "Read more" control
 *   - loading: fetch in flight; control disabled with a spinner
 *   - full:    full text shown, control removed
 *   - error:   fetch failed; preview kept, "Read more" restored for retry
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
  const [loading, setLoading] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);

  // The active channel is the key the normalized message map is stored under.
  const { channel } = useCustomSelector((state: any) => ({
    channel: state.Chat?.subThreadId,
  }));

  const handleReadMore = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!channel || !messageId) return;

      setLoading(true);
      const text = await getFullMessageApi(channel, messageId);
      setLoading(false);

      if (text != null) {
        setFullText(text);
      }
      // On failure getFullMessageApi already surfaces a toast; we keep the
      // preview and leave the "Read more" control in place for retry.
    },
    [channel, messageId]
  );

  return (
    <div>
      {renderContent(fullText != null ? fullText : preview)}

      {fullText == null && (
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
