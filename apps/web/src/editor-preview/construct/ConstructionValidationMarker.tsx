import { MeasurementText, formatMeasurementText, useMeasurementUnits } from "@cabane/engine";
import { useCabaneDom } from "@cabane/engine";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorIcon } from "../../editor-chrome/EditorIcon";
import type { ConstructContextualIssue } from "./contextual-validation";

export function ConstructionValidationMarker({
  issues,
  number,
  active,
  onActivate,
  onDismiss,
}: {
  issues: readonly ConstructContextualIssue[];
  number: number;
  active: boolean;
  onActivate: () => void;
  onDismiss: () => void;
}) {
  const dom = useCabaneDom();
  const units = useMeasurementUnits();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 340,
    maxHeight: window.innerHeight - 24,
  });
  const label = `Error ${number}${issues.length > 1 ? ` · ${issues.length} issues` : ""}`;
  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => {
      if (!trigger.current?.parentElement?.contains(dom.root.activeElement)) setOpen(false);
    }, 120);
  };
  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = dom.root === document ? null : dom.portalContainer.getBoundingClientRect();
    const width = Math.min(340, (bounds?.width ?? window.innerWidth) - 24);
    const height = Math.min(
      tooltip.current.scrollHeight,
      (bounds?.height ?? window.innerHeight) - 24,
    );
    const startX = bounds?.left ?? 0;
    const startY = bounds?.top ?? 0;
    const availableHeight = bounds?.height ?? window.innerHeight;
    setPosition({
      width,
      maxHeight: availableHeight - 24,
      left: Math.max(
        12,
        Math.min(
          (bounds?.width ?? window.innerWidth) - width - 12,
          anchor.left - startX + anchor.width / 2 - width / 2,
        ),
      ),
      top: Math.max(
        12,
        Math.min(
          availableHeight - height - 12,
          anchor.top - startY > height + 20
            ? anchor.top - startY - height - 8
            : anchor.bottom - startY + 8,
        ),
      ),
    });
  }, [open, dom, position.width]);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof window.Node) || !tooltip.current?.contains(event.target))
        dismiss();
    };
    dom.events.addEventListener("keydown", keydown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      dom.events.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open, dom]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  return (
    <>
      <div
        className={`construction-validation-marker ${active ? "is-active" : ""}`}
        role="group"
        aria-label={label}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onMouseEnter={show}
        onMouseLeave={leave}
        onFocus={show}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          className="construction-validation-marker__details"
          aria-label={`${label}. ${issues.map((issue) => formatMeasurementText(issue.message, units)).join(" ")}`}
          aria-describedby={open ? id : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
        >
          <EditorIcon name="warning" />
          <strong>{number}</strong>
        </button>
        <button
          type="button"
          className="construction-validation-marker__dismiss"
          aria-label={`Hide error label: ${label}`}
          title="Hide this label. Use Locate in the issue list to show it again."
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
            onDismiss();
          }}
        >
          <EditorIcon name="close" />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            className="construction-validation-tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={leave}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <strong>{label}</strong>
            <ul>
              {issues.map((issue, index) => (
                <li key={index}>
                  <p>
                    <MeasurementText>{issue.message}</MeasurementText>
                  </p>
                  <p>
                    <MeasurementText>{issue.suggestion}</MeasurementText>
                  </p>
                </li>
              ))}
            </ul>
          </div>,
          dom.portalContainer,
        )}
    </>
  );
}
