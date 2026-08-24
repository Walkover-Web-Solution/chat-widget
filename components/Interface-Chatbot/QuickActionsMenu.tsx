'use client';

import {
  EllipsisVertical,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColor } from "../Chatbot/hooks/useColor";

export interface QuickActionsMenuProps {
  /** Open state (controlled). If omitted, the component manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  isChatbotMinimized?: boolean;
  fullScreen?: boolean;

  showMinimize?: boolean;
  showFullScreen?: boolean;
  showNewConversation?: boolean;

  onMinimize?: () => void;
  onToggleFullScreen?: () => void;
  onNewConversation?: () => void;

  /** Extra class for the trigger button. */
  triggerClassName?: string;
  /** Extra class for the menu panel. */
  menuClassName?: string;
  /** Icon size for the trigger. */
  triggerIconSize?: number;
  /** Apply the `var(--icon-color)` color to the trigger icon. */
  useIconColor?: boolean;
  /** Where to anchor the menu relative to the trigger. Defaults to "bottom". */
  position?: "top" | "bottom";
  /**
   * Background color used for the trigger's hover state.
   */
  triggerHoverBg?: string;
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  open: controlledOpen,
  onOpenChange,
  isChatbotMinimized = false,
  fullScreen = false,
  showMinimize = false,
  showFullScreen = false,
  showNewConversation = false,
  onMinimize,
  onToggleFullScreen,
  onNewConversation,
  triggerClassName = "cursor-pointer p-2 rounded-full transition-colors hover:bg-gray-200 ",
  menuClassName = "absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-[var(--drawer-color)] ring-1 ring-black/5 dark:ring-[var(--icon-color)]/20 focus:outline-none z-50 py-1",
  triggerIconSize = 22,
  useIconColor = false,
  position = "bottom",
  triggerHoverBg,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;

  useColor(); // keeps existing behavior if hook has side effects

  const menuRef = useRef<HTMLDivElement | null>(null);

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  const triggerIconProps = useIconColor
    ? { color: "var(--icon-color)" as const }
    : {};

  const actions = useMemo(() => {
    const items: {
      label: string;
      icon: React.ReactNode;
      onClick: () => void;
    }[] = [];

    if (showMinimize) {
      items.push({
        label: isChatbotMinimized ? "Expand chat" : "Minimize chat",
        icon: isChatbotMinimized ? (
          <Maximize2
            size={18}
            style={{ transform: "rotate(90deg)" }}
          />
        ) : (
          <Minus size={18} />
        ),
        onClick: () => onMinimize?.(),
      });
    }

    if (showFullScreen) {
      items.push({
        label: fullScreen ? "Exit full screen" : "Expand view",
        icon: fullScreen ? (
          <Minimize2
            size={18}
            style={{ transform: "rotate(90deg)" }}
          />
        ) : (
          <Maximize2
            size={18}
            style={{ transform: "rotate(90deg)" }}
          />
        ),
        onClick: () => onToggleFullScreen?.(),
      });
    }

    if (showNewConversation) {
      items.push({
        label: "New conversation",
        icon: <Plus size={18} />,
        onClick: () => onNewConversation?.(),
      });
    }

    return items;
  }, [
    showMinimize,
    showFullScreen,
    showNewConversation,
    isChatbotMinimized,
    fullScreen,
    onMinimize,
    onToggleFullScreen,
    onNewConversation,
  ]);

  // No actions
  if (actions.length === 0) {
    return null;
  }

  // Single action -> icon only with DaisyUI tooltip
  if (actions.length === 1) {
    const action = actions[0];

    return (
      <div
        className="tooltip tooltip-bottom"
        data-tip={action.label}
      >
        <button
          type="button"
          aria-label={action.label}
          className={triggerClassName}
          onClick={action.onClick}
        >
          {action.icon}
        </button>
      </div>
    );
  }

  // Multiple actions -> dropdown
  return (
    <div
      ref={menuRef}
      className="relative inline-block text-left"
    >
      <button
        type="button"
        aria-label="Quick actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={triggerClassName}
      >
        <EllipsisVertical
          size={triggerIconSize}
          style={{ color: "inherit" }}
          {...triggerIconProps}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          className={
            position === "top"
              ? "absolute right-0 bottom-full mb-2 w-[180px] rounded-md shadow-lg bg-white dark:bg-[var(--drawer-color)] ring-1 ring-black/5 dark:ring-[var(--icon-color)]/20 focus:outline-none z-50 py-1"
              : `w-[180px] ${menuClassName}`
          }
        >
          {actions.map((action) => (
            <button
              key={action.label}
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                action.onClick();
                closeMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-gray-700 dark:text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-white/10"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickActionsMenu;