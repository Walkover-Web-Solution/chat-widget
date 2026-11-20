/* eslint-disable */
import { createContext } from "react";

export const MessageContext = createContext<{
  messageRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}>({
  messageRef: { current: null },
});
