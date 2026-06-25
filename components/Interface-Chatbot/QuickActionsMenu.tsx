'use client';

import { EllipsisVertical, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

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
   * Background color used for the trigger's hover state. Pass a theme-derived
   * value (e.g. a translucent overlay) so the wash matches any header color.
   * If omitted, the trigger falls back to the `hover:bg-gray-200` class.
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
  triggerClassName = "cursor-pointer p-2 rounded-full hover:bg-gray-200 transition-colors icn",
  menuClassName = "absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 py-1",
  triggerIconSize = 22,
  useIconColor = false,
  position = "bottom",
  triggerHoverBg,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeMenu = () => setOpen(false);

  const triggerIconProps = useIconColor ? { color: "var(--icon-color)" as const } : {};

  const triggerHoverHandlers = triggerHoverBg
    ? {
        onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = triggerHoverBg;
        },
        onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
        },
      }
    : {};

  const trigger = useMemo(() => (
    <button
      type="button"
      aria-label="Quick actions"
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={() => setOpen(!open)}
      className={triggerClassName}
      {...triggerHoverHandlers}
    >
      <EllipsisVertical size={triggerIconSize} {...triggerIconProps} />
    </button>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [open, triggerClassName, triggerIconSize, useIconColor]);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {trigger}

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          className={
            "w-[180px] " +
            (position === "top"
              ? "absolute right-0 bottom-full mb-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 py-1"
              : menuClassName)
          }
        >
          {showMinimize && (
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onMinimize?.(); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {isChatbotMinimized
                ? <Maximize2 size={18} style={{ transform: 'rotate(90deg)' }} />
                : <Minus size={18} />}
              <span>{isChatbotMinimized ? 'Expand chat' : 'Minimize chat'}</span>
            </button>
          )}

          {showFullScreen && (
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onToggleFullScreen?.(); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {fullScreen
                ? <Minimize2 size={18} style={{ transform: 'rotate(90deg)' }} />
                : <Maximize2 size={18} style={{ transform: 'rotate(90deg)' }} />}
              <span>{fullScreen ? 'Exit full screen' : 'Expand view'}</span>
            </button>
          )}

          {showNewConversation && (
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onNewConversation?.(); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Plus size={18} />
              <span>New conversation</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickActionsMenu;
