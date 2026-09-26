import { submitFeedback } from '@/config/helloApi';
import { addUrlDataHoc } from '@/hoc/addUrlDataHoc';
import { updateHelloMessage } from '@/store/chat/chatSlice';
import { $ReduxCoreType } from '@/types/reduxCore';
import { useCustomSelector } from '@/utils/deepCheckSelector';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

function addDynamicValuesInText(text: string, dynamic_values: Record<string, string>): string {
  if (!text || !dynamic_values) return text;

  return text.replace(/##(\w+)##/g, (match, key) => {
    return dynamic_values[key] || match;
  });
}

const RATING_OPTIONS = [
  { value: "terrible", emoji: "😡", label: "Terrible" },
  { value: "bad", emoji: "😕", label: "Bad" },
  { value: "ok", emoji: "😐", label: "Okay" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "amazing", emoji: "😄", label: "Amazing" },
] as const;

const EMOJI_BY_RATING: Record<string, string> = Object.fromEntries(
  RATING_OPTIONS.map(o => [o.value, o.emoji])
);

function RenderHelloFeedbackMessage({ message, chatSessionId }: { message: any, chatSessionId: string }) {
  const alreadySubmitted = Boolean(message?.rating || message?.feedback_msg);

  const [feedbackText, setFeedbackText] = useState(message?.feedback_msg || "");
  const [selectedRating, setSelectedRating] = useState(message?.rating || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRatingError, setShowRatingError] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const feedbackSubmitted = alreadySubmitted || justSubmitted;
  const dispatch = useDispatch();
  const { widgetLogo, feedBackHeaderText } = useCustomSelector((state: $ReduxCoreType) => ({
    widgetLogo: state?.Hello?.[chatSessionId]?.widgetInfo?.logo?.path,
    feedBackHeaderText: addDynamicValuesInText(state.Hello?.[chatSessionId]?.widgetInfo?.feedback_text, message?.dynamic_values)
  }))

  const handleSubmitFeedback = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedRating) {
      setShowRatingError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({
        feedbackMsg: feedbackText,
        rating: selectedRating,
        token: message?.token || "",
        id: message?.id || 0
      });
      setJustSubmitted(true);
      // Persist the submitted rating/comment back into the message store so it
      // survives a channel switch or remount, not just this component instance.
      if (message?.id && message?.channel) {
        dispatch(updateHelloMessage({
          subThreadId: message.channel,
          message: {
            ...message,
            type: 'feedback',
            rating: selectedRating,
            feedback_msg: feedbackText,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [feedbackText, selectedRating, message]);

  // Keep local draft state (rating/comment) in sync whenever the underlying
  // message actually carries submitted data, e.g. after switching channels.
  useEffect(() => {
    if (message?.rating || message?.feedback_msg) {
      setSelectedRating(message?.rating || "");
      setFeedbackText(message?.feedback_msg || "");
    }
  }, [message?.rating, message?.feedback_msg]);


  const handleRatingSelect = useCallback((rating: string) => () => {
    setSelectedRating(rating);
    setShowRatingError(false);
  }, []);

  if (feedbackSubmitted) {
    const displayEmoji = EMOJI_BY_RATING[message?.rating || selectedRating] ?? "🙂";
    const displayText = message?.feedback_msg || feedbackText;
    return (
      <div className="py-1 px-1" style={{ maxWidth: '360px' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none shrink-0">{displayEmoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-base-content">Thanks for your feedback!</p>
            {displayText && (
              <p className="text-xs text-base-content/60 mt-0.5 line-clamp-2">{displayText}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-1 px-1" style={{ maxWidth: '400px' }}>
      {widgetLogo && (
        <div className="flex justify-center mb-2.5">
          <img
            src={widgetLogo}
            alt="Widget Logo"
            className="max-w-full h-auto rounded-lg"
            style={{ maxHeight: '56px' }}
          />
        </div>
      )}

      {feedBackHeaderText ? (
        <div
          className="text-sm font-medium text-base-content mb-3 leading-snug"
          dangerouslySetInnerHTML={{ __html: feedBackHeaderText }}
        />
      ) : (
        <p className="text-sm font-medium text-base-content mb-3">How was your experience?</p>
      )}

      <div className="flex items-center justify-between gap-1">
        {RATING_OPTIONS.map(({ value, emoji, label }) => {
          const active = selectedRating === value;
          return (
            <button
              type="button"
              key={value}
              aria-label={label}
              aria-pressed={active}
              onClick={(e) => { e.stopPropagation(); handleRatingSelect(value)() }}
              className={`
                flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg flex-1
                transition-transform duration-150 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                ${active ? "bg-primary/10 scale-110" : "hover:bg-base-200 opacity-60 hover:opacity-100"}
              `}
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className={`text-[10px] leading-none ${active ? "text-primary font-semibold" : "text-base-content/50"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {showRatingError && (
        <p className="text-xs text-error font-medium mt-1.5 text-center">
          Please select a rating to continue
        </p>
      )}

      <textarea
        className="w-full mt-3 px-3 py-2 text-sm rounded-lg border border-base-300 bg-base-100 placeholder:text-base-content/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150 resize-none"
        rows={2}
        placeholder="Add a comment (optional)"
        value={feedbackText}
        onClick={(e) => { e.stopPropagation() }}
        onChange={(e) => setFeedbackText(e.target.value)}
      />

      <button
        type="button"
        className="w-full mt-2.5 h-9 rounded-lg text-sm font-medium bg-primary text-primary-content hover:bg-primary-focus transition-colors duration-150 disabled:opacity-70 disabled:cursor-wait"
        disabled={isSubmitting}
        onClick={handleSubmitFeedback}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
            Submitting...
          </span>
        ) : (
          "Submit Feedback"
        )}
      </button>
    </div>
  )
}

export default React.memo(addUrlDataHoc(RenderHelloFeedbackMessage));
