import { useCabaneDom, type FloorEditorTool } from "@cabane/engine";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { EditorActionButton } from "./EditorActionButton";
import type { EditorIconName } from "./EditorIcon";
import "./editor-tool-group.css";

export interface EditorToolOption {
  tool: FloorEditorTool;
  label: string;
  icon: EditorIconName;
  shortcut?: string;
}

/** Portal keeps the disclosure outside the horizontally scrolling tool strip. */
export function EditorToolGroup({
  label,
  panelLabel,
  icon,
  tools,
  tool,
  onToolChange,
  disabled,
}: {
  label: string;
  panelLabel: string;
  icon: EditorIconName;
  tools: readonly EditorToolOption[];
  tool: FloorEditorTool | null;
  disabled?: boolean | undefined;
  onToolChange: (tool: FloorEditorTool) => void;
}) {
  const dom = useCabaneDom();
  const id = useId();
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const focusOnOpen = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };
  const close = () => {
    cancelLeave();
    pinned.current = false;
    setPosition(null);
  };
  const open = () => {
    if (disabled) return;
    cancelLeave();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const bounds = dom.root === document ? null : dom.portalContainer.getBoundingClientRect();
    const width = bounds?.width ?? window.innerWidth;
    setPosition({
      left: Math.max(8, Math.min(width - 176, rect.left - (bounds?.left ?? 0))),
      top: rect.bottom - (bounds?.top ?? 0) + 4,
    });
  };
  const leave = () => {
    if (!pinned.current) leaveTimer.current = setTimeout(() => setPosition(null), 150);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      trigger.current?.querySelector("button")?.focus();
    }
    if (event.key === "ArrowDown" && event.currentTarget === trigger.current) {
      event.preventDefault();
      pinned.current = true;
      focusOnOpen.current = true;
      open();
    }
    if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      event.currentTarget === panel.current
    ) {
      event.preventDefault();
      const buttons = Array.from(panel.current.querySelectorAll("button"));
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      buttons[
        (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
      ]?.focus();
    }
  };
  useEffect(() => {
    if (disabled) {
      pinned.current = false;
      setPosition(null);
      return;
    }
    if (!position) return;
    if (focusOnOpen.current) {
      focusOnOpen.current = false;
      panel.current?.querySelector("button")?.focus();
    }
    const dismiss = (event: Event) => {
      if (
        event
          .composedPath()
          .some((target) => target === trigger.current || target === panel.current)
      )
        return;
      pinned.current = false;
      setPosition(null);
    };
    const reposition = () => {
      pinned.current = false;
      setPosition(null);
    };
    dom.events.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", reposition);
    return () => {
      dom.events.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", reposition);
    };
  }, [dom, position, disabled]);
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );
  return (
    <>
      <div
        ref={trigger}
        className="editor-tool-group"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") open();
        }}
        onPointerLeave={leave}
        onKeyDown={keyDown}
      >
        <EditorActionButton
          tooltip={false}
          disabled={disabled}
          icon={icon}
          label={label}
          showLabel
          pressed={tools.some((item) => item.tool === tool)}
          expanded={Boolean(position)}
          controls={position ? id : undefined}
          onClick={() => {
            if (pinned.current) close();
            else {
              pinned.current = true;
              focusOnOpen.current = true;
              open();
            }
          }}
        />
      </div>
      {position &&
        createPortal(
          <div
            inert={disabled}
            id={id}
            ref={panel}
            className="editor-tool-group__panel"
            role="group"
            aria-label={panelLabel}
            style={position}
            onPointerEnter={cancelLeave}
            onPointerLeave={leave}
            onKeyDown={keyDown}
          >
            {tools.map((item) => (
              <EditorActionButton
                key={item.tool}
                tooltip={false}
                icon={item.icon}
                label={item.label}
                shortcut={item.shortcut}
                keyShortcuts={item.shortcut}
                showLabel
                pressed={tool === item.tool}
                onClick={() => {
                  onToolChange(item.tool);
                  close();
                  trigger.current?.querySelector("button")?.focus();
                }}
              />
            ))}
          </div>,
          dom.portalContainer,
        )}
    </>
  );
}
