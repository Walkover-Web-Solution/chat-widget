import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import { IconButton } from "@mui/material";
import React from "react";
import "./InterfaceChatbot.css";

function MoveToDownButton({ movetoDown, showScrollButton, backgroundColor, foregroundColor }: { movetoDown: () => void, showScrollButton: boolean, backgroundColor: string, foregroundColor: string }) {
  if (!showScrollButton) return null;
  return (
    <IconButton
      onClick={movetoDown}
      className="move-to-down-button"
      style={{
        '--down-btn-bg-color': backgroundColor || "#333",
        '--down-btn-text-color': foregroundColor || "white",
      } as React.CSSProperties}
      disableRipple
    >
      <KeyboardDoubleArrowDownIcon color="inherit" />
    </IconButton>
  );
}

export default MoveToDownButton;
