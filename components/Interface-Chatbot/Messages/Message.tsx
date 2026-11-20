'use client';
/* eslint-disable */
import { useColor } from "@/components/Chatbot/hooks/useColor";
import React, { useMemo } from "react";
import DateGroup from "./DateGroup";
import HumanOrBotMessageCard from "./HumanOrBotMessage";
import "./Message.css";
import UserMessageCard from "./UserMessage";
import VoiceCallMessage from "./VoiceCallMessage";

// Renders one message by role, with its date group

interface MessageProps {
  message: any;
  prevTime?: string | number | null;
  isLastMessage?: boolean;
}

const ROLE_USER = "user";
const ROLE_HUMAN = "Human";
const ROLE_BOT = "Bot";
const ROLE_VOICE_CALL = "voice_call";

function Message({ message, prevTime, isLastMessage }: MessageProps) {
  const { primaryBgColor, foregroundColor } = useColor();

  /**
   * Memoize role-based rendering to prevent unnecessary re-computations
   */
  const messageContent = useMemo(() => {
    const role = message?.role;

    switch (role) {
      case ROLE_USER:
        return (
          <UserMessageCard
            message={message}
            foregroundColor={foregroundColor}
            backgroundColor={primaryBgColor}
          />
        );

      case ROLE_HUMAN:
        return <HumanOrBotMessageCard message={message} isLastMessage={isLastMessage} />;

      case ROLE_BOT:
        return <HumanOrBotMessageCard message={message} isBot={true} isLastMessage={isLastMessage} />;

      case ROLE_VOICE_CALL:
        return <VoiceCallMessage message={message} />;

      default:
        return null;
    }
  }, [message, foregroundColor, primaryBgColor, isLastMessage]);

  return (
    <div className="w-full">
      {message?.time && (
        <DateGroup
          prevTime={prevTime}
          messageTime={message.time}
          key={message.time}
          backgroundColor={primaryBgColor}
          foregroundColor={foregroundColor}
        />
      )}
      {messageContent}
    </div>
  );
}

export default React.memo(Message);