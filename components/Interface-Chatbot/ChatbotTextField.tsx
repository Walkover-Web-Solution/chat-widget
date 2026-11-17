'use client';
import { errorToast } from "@/components/customToast";
import { uploadAttachmentToHello } from "@/config/helloApi";
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { useTypingStatus } from "@/hooks/socketEventEmitter";
import { setDataInDraftReducer } from "@/store/draftData/draftDataSlice";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { ParamsEnums } from "@/utils/enums";
import { isColorLight } from "@/utils/themeUtility";
import { TextField, useTheme } from "@mui/material";
import debounce from "lodash.debounce";
import { Paperclip, Send, Smile, X } from "lucide-react";
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useChatActions } from "../Chatbot/hooks/useChatActions";
import { useSendMessageToHello } from "../Chatbot/hooks/useHelloIntegration";
import CallButton from "./CallButton";
import { useReplyContext } from "./contexts/ReplyContext";
import EmojiSelector from "./EmojiSelector";
import { MessageContext } from "./InterfaceChatbot";
import ImageWithFallback from "./Messages/ImageWithFallback";
import ReplyPreview from "./ReplyPreview";

interface ChatbotTextFieldProps {
  className?: string;
  chatSessionId: string
  tabSessionId: string
  subThreadId: string;
  currentTeamId: string
  currentChannelId: string
}

const MAX_IMAGES = 4;

const ChatbotTextField: React.FC<ChatbotTextFieldProps> = ({ className, chatSessionId, tabSessionId, subThreadId, currentTeamId = "", currentChannelId = "" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const theme = useTheme();
  const dispatch = useDispatch();
  const isLight = isColorLight(theme.palette.primary.main);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emitTypingStatus = useTypingStatus({ chatSessionId, tabSessionId });

  // Reply context
  const { replyToMessage, clearReply } = useReplyContext();

  const { inbox_id, show_send_button, assigned_type, ticketMode, isChannelBlocked, prefillInputMessage } = useCustomSelector((state) => ({
    // Peer (widget-to-widget) channel blocked by the other side: sending is disabled
    isChannelBlocked: !!state.Hello?.[chatSessionId]?.channelListData?.channels?.find((channel: any) => channel?.channel === currentChannelId)?.is_blocked,
    inbox_id: state.Hello?.[chatSessionId]?.widgetInfo?.inbox_id,
    show_send_button: typeof state.Hello?.[chatSessionId]?.helloConfig?.show_send_button === 'boolean' ? state.Hello?.[chatSessionId]?.helloConfig?.show_send_button : true,
    assigned_type: (() => {
      const foundType = state.Hello?.[chatSessionId]?.channelListData?.channels?.find((channel: any) => channel?.channel === currentChannelId)?.assigned_type;
      return foundType === undefined ? 'bot' : foundType;
    })(),
    ticketMode: state.Hello?.[chatSessionId]?.helloConfig?.viewMode === 'ticket',
    prefillInputMessage: state.draftData?.prefillInputMessage || null,
  }));

  const { messageRef } = useContext(MessageContext);
  const sendMessageToHello = useSendMessageToHello({
    messageRef,
    replyToMessageId: replyToMessage?.message_id || replyToMessage?.id
  });

  const { setImages } = useChatActions();

  const { images = [], loading } = useCustomSelector((state) => ({
    images: state.Chat.images || [],
    loading: state.Chat.loading,
  }))

  const buttonDisabled = useMemo(() => {
    return ((assigned_type !== 'bot' && assigned_type !== 'workflow') ? false : loading) || isUploading || (!inputValue.trim() && images.length === 0)
  }, [loading, isUploading, inputValue, images, assigned_type]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !buttonDisabled) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = useCallback(() => {
    if (isChannelBlocked) return;
    setInputValue('');
    if (prefillInputMessage) {
      dispatch(setDataInDraftReducer({ prefillInputMessage: null }));
    }
    sendMessageToHello?.();
    emitTypingStatus("not-typing");
    // Clear reply after sending message
    clearReply();
  }, [sendMessageToHello, clearReply, isChannelBlocked, emitTypingStatus, prefillInputMessage, dispatch]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event?.data?.type === "open") {
      messageRef?.current?.focus();
    }
  }, [messageRef]);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleMessage]);

  useLayoutEffect(() => {
    if (!prefillInputMessage) return;
    setInputValue(prefillInputMessage);
    if (messageRef?.current) {
      messageRef.current.value = prefillInputMessage;
      messageRef.current.focus();
    }
  }, [prefillInputMessage, messageRef]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const totalImagesAfterUpload = filesArray.length + images.length;

    if (totalImagesAfterUpload > MAX_IMAGES) {
      errorToast(`You can only upload up to ${MAX_IMAGES} images.`);
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = filesArray.map(async (file) => {
        const response = await uploadAttachmentToHello(file, inbox_id);
        if (!response) {
          errorToast("Failed to upload images. Please try again.");
          return null;
        }
        return response?.data?.[0];
      });

      const uploadedUrls = (await Promise.all(uploadPromises)).filter((url): url is string => url !== null);
      setImages([...images, ...uploadedUrls]);
    } catch (error) {
      console.error("Error uploading images:", error);
      errorToast("Failed to upload images. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [images, setImages, inbox_id]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages(images.filter((_, i) => i !== index));
  }, [images, setImages]);

  const focusTextField = useCallback(() => {
    setTimeout(() => {
      messageRef?.current?.focus();
    }, 0);
  }, [messageRef]);

  const debouncedStopTyping = useMemo(
    () => debounce(() => emitTypingStatus("not-typing"), 2000),
    [emitTypingStatus]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (messageRef.current) {
      messageRef.current.value = value;
    }
    setInputValue(value);
    if (prefillInputMessage) {
      dispatch(setDataInDraftReducer({ prefillInputMessage: null }));
    }

    if (value.trim()) {
      emitTypingStatus("typing");
      debouncedStopTyping();
    } else {
      emitTypingStatus("not-typing");
      debouncedStopTyping.cancel();
    }
  }, [messageRef, emitTypingStatus, debouncedStopTyping, prefillInputMessage, dispatch]);

  useEffect(() => {
    return () => {
      debouncedStopTyping.cancel();
    };
  }, [debouncedStopTyping]);

  const imagePreviewsSection = useMemo(() => {
    if (images.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-3 my-4 px-4">
        {images.map((image, index) => (
          <div key={index} className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden shadow-md transition-transform hover:scale-105">
              <ImageWithFallback
                src={image?.path}
                alt={`Uploaded Preview ${index + 1}`}
                thumbnail
                canDownload={false}
                preview={true}
              />
            </div>
            <button
              onClick={() => handleRemoveImage(index)}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  }, [images, handleRemoveImage]);

  const textFieldStyles = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      padding: '4px 8px',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
  }), []);

  const uploadButton = useMemo(() => {
    if (!subThreadId) return null;

    return (
      <>
        <input
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          onChange={handleImageUpload}
          className="hidden"
          id="upload-image"
          multiple
          ref={fileInputRef}
        />
        <label htmlFor="upload-image" className="cursor-pointer">
          <div className="flex px-2 py-1.5 w-8 h-8 items-center group">
            {isUploading ? (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
                <span className="text-[10px] font-medium text-gray-600 dark:text-white">Uploading...</span>
              </div>
            ) : (
              <Paperclip className="w-4 h-4 group-hover:scale-110 transition-transform duration-200 icn" />
            )}
          </div>
        </label>
      </>
    );
  }, [isUploading, handleImageUpload, subThreadId]);

  const handleEmojiSelect = (data: { emoji: string }) => {
    if (messageRef?.current) {
      const currentValue = messageRef.current.value || '';
      const start = messageRef.current?.selectionStart || 0;
      const end = messageRef.current?.selectionEnd || 0;
      const newValue = currentValue?.substring(0, start) + (data?.emoji || '') + currentValue?.substring(end);
      messageRef.current.value = newValue;
      setInputValue(newValue);
      // Set the cursor position right after the inserted emoji
      messageRef.current?.setSelectionRange(start + (data?.emoji || '')?.length, start + (data?.emoji || '')?.length);
      // Trigger onChange event to sync with any other handlers
      const event = new Event('input', { bubbles: true });
      messageRef.current?.dispatchEvent(event);
    }
    setShowEmojiPicker(false);
    // Focus back on the input field
    setTimeout(() => {
      focusTextField();
    }, 50);
  }

  if (isChannelBlocked) {
    return (
      <div className={`relative w-full shadow-sm ${className}`}>
        <div
          className="w-full p-3 rounded-xl border border-gray-300 bg-gray-100 dark:bg-[rgb(48,48,48)] text-center text-sm text-gray-500 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          You can no longer send messages in this conversation.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full shadow-sm ${className}`}>
      {/* Reply Preview */}
      <ReplyPreview
        replyToMessage={replyToMessage}
        onCloseReply={clearReply}
      />

      {imagePreviewsSection}

      <div className="w-full h-full cursor-text relative" onClick={focusTextField}>
        <EmojiSelector
          isVisible={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => { setShowEmojiPicker(false); focusTextField(); }}
        />
        <div
          className="relative flex-col h-full items-center justify-between gap-2 p-2 bg-white dark:bg-[rgb(48,48,48)] rounded-xl border border-gray-300 focus-within:outline focus-within:outline-2 focus-within:outline-offset-0"
          style={{ outlineColor: theme.palette.primary.main }}
        >
          <TextField
            key={subThreadId || currentTeamId}
            inputRef={messageRef}
            value={inputValue}
            onChange={handleInputChange}
            multiline
            fullWidth
            onKeyDown={handleKeyDown}
            placeholder="Message AI Assistant..."
            className="h-full min-h-[10px] max-h-[400px] bg-transparent focus:outline-none disabled:cursor-not-allowed"
            maxRows={6}
            minRows={ticketMode ? 3 : 1}
            sx={textFieldStyles}
            autoFocus
            inputMode="text"
            type="text"
          />

          <div className="flex justify-between items-center w-full">
            {/* Left section: Emoji and Upload */}
            <div className="flex items-center">
              <div
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowEmojiPicker(!showEmojiPicker) }}
                className="group flex items-center justify-center w-8 h-8 cursor-pointer"
                aria-label="Add emoji"
              >
                <Smile className="w-4 h-4 group-hover:scale-110 transition-transform duration-200 icn" />
              </div>
              {uploadButton}
            </div>

            {/* Right section: Call + Send button side by side */}
            <div className="flex items-center gap-2">
              <CallButton />
              {show_send_button && (
                <button
                  onClick={() => !buttonDisabled && handleSendMessage()}
                  className="rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:scale-105 transition-transform duration-200"
                  disabled={buttonDisabled}
                  style={{
                    backgroundColor: buttonDisabled ? '#d1d5db' : theme.palette.primary.main
                  }}
                  aria-label="Send message"
                >
                  <Send className={`w-3 h-3 md:w-4 md:h-4 ${isLight ? 'text-black' : 'text-white'}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default React.memo(addUrlDataHoc(ChatbotTextField, [ParamsEnums.subThreadId, ParamsEnums.currentTeamId, ParamsEnums.currentChannelId]));
