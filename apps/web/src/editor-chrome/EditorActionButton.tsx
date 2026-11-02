import { useCabaneDom } from "@cabane/engine";
import { useEffect, useId, useState, type MouseEvent, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { EditorIcon, type EditorIconName } from "./EditorIcon";

interface EditorActionButtonProps {
  icon: EditorIconName;
  label: string;
  shortcut?: string | undefined;
  keyShortcuts?: string | undefined;
  showLabel?: boolean;
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  warning?: string | undefined;
  tooltip?: boolean;
  expanded?: boolean;
  controls?: string | undefined;
  onClick: () => void;
}

/** Tooltips live outside the scrollable action bar, including on narrow screens. */
export function EditorActionButton({
  icon,
  label,
  shortcut,
  keyShortcuts,
  showLabel = false,
  pressed,
  disabled,
  disabledReason,
  warning,
  onClick,
  tooltip = true,
  expanded,
  controls,
}: EditorActionButtonProps) {
  const dom = useCabaneDom();
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const showTooltip = (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    if (disabled || !tooltip) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const portalBounds = dom.root === document ? null : dom.portalContainer.getBoundingClientRect();
    const width = portalBounds?.width ?? window.innerWidth;
    const inset = Math.min(112, width / 2);
    setPosition({
      left: Math.max(
        inset,
        Math.min(width - inset, rect.left + rect.width / 2 - (portalBounds?.left ?? 0)),
      ),
      top: rect.bottom + 9 - (portalBounds?.top ?? 0),
    });
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    dom.events.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      dom.events.removeEventListener("keydown", onKeyDown);
    };
  }, [position, dom]);

  return (
    <>
      <button
        type="button"
        className="editor-action-button"
        data-show-label={showLabel || undefined}
        aria-label={label}
        title={disabled ? disabledReason : undefined}
        aria-description={disabled ? disabledReason : warning}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-keyshortcuts={keyShortcuts}
        disabled={disabled}
        aria-describedby={position && !disabled ? tooltipId : undefined}
        onClick={onClick}
        onFocus={showTooltip}
        onBlur={() => setPosition(null)}
        onMouseEnter={showTooltip}
        onMouseLeave={(event) => {
          if (dom.root.activeElement !== event.currentTarget) setPosition(null);
        }}
      >
        <EditorIcon name={icon} />
        {showLabel && <span>{label}</span>}
        {expanded !== undefined && (
          <span className="editor-action-button__disclosure">
            <EditorIcon name="chevron" />
          </span>
        )}
        {warning && (
          <span className="editor-action-button__warning">
            <EditorIcon name="warning" />
          </span>
        )}
      </button>
      {position &&
        !disabled &&
        createPortal(
          <div role="tooltip" id={tooltipId} className="editor-action-tooltip" style={position}>
            {warning ?? label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </div>,
          dom.portalContainer,
        )}
    </>
  );
}
