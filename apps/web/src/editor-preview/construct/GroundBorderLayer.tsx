import {
  formatLength,
  GROUND_EDGES,
  useMeasurementUnits,
  type GroundMargins,
  type homeGroundFrame,
} from "@cabane/engine";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { constructPixelsPerMeter } from "./plan-screen-scale";
import "./ground-borders.css";

type Edge = keyof GroundMargins;
type Frame = NonNullable<ReturnType<typeof homeGroundFrame>>;
type Drag = {
  edge: Edge;
  pointerId: number;
  start: number;
  pixelsPerMeter: number;
  original: GroundMargins;
};

const horizontalMovement = (edge: Edge) => edge === "left" || edge === "right";
const direction = (edge: Edge) => (edge === "left" || edge === "top" ? -1 : 1);
const distanceAfterMove = (original: number, delta: number) =>
  Math.max(0, Math.round((original + delta) * 100) / 100);

export function GroundBorderLayer({
  frame,
  onCommit,
}: {
  frame: Frame;
  onCommit: (margins: GroundMargins) => void;
}) {
  const units = useMeasurementUnits();
  const get = useThree((state) => state.get);
  const rectangle = useRef<HTMLDivElement>(null);
  const active = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ edge: Edge; margins: GroundMargins } | null>(null);
  const margins = preview?.margins ?? frame.margins;
  const left = margins.left - frame.margins.left;
  const right = margins.right - frame.margins.right;
  const top = margins.top - frame.margins.top;
  const bottom = margins.bottom - frame.margins.bottom;
  const syncSize = () => {
    if (!rectangle.current) return;
    const { camera, size } = get();
    const scale = constructPixelsPerMeter(camera, size.height);
    rectangle.current.style.width = `${(frame.width + left + right) * scale}px`;
    rectangle.current.style.height = `${(frame.depth + top + bottom) * scale}px`;
  };
  useLayoutEffect(syncSize);
  useFrame(syncSize);
  const cancel = () => {
    active.current = null;
    setPreview(null);
  };
  const updatedMargin = (event: PointerEvent, drag: Drag) => {
    const client = horizontalMovement(drag.edge) ? event.clientX : event.clientY;
    const delta = ((client - drag.start) * direction(drag.edge)) / drag.pixelsPerMeter;
    return delta === 0
      ? drag.original[drag.edge]
      : distanceAfterMove(drag.original[drag.edge], delta);
  };
  return (
    <Html
      center
      position={[frame.centerX + (right - left) / 2, 0, frame.centerZ + (bottom - top) / 2]}
      zIndexRange={[4, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div ref={rectangle} className="construction-ground-borders">
        {GROUND_EDGES.map((edge) => (
          <button
            type="button"
            key={edge}
            data-edge={edge}
            className="construction-ground-border"
            aria-label={`Resize ${edge} map border`}
            title={`Drag the ${edge} map border, or use the arrow keys.`}
            onPointerDown={(event) => {
              if (event.button !== 0 || active.current) return;
              event.stopPropagation();
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              const { camera, size } = get();
              active.current = {
                edge,
                pointerId: event.pointerId,
                original: frame.margins,
                pixelsPerMeter: constructPixelsPerMeter(camera, size.height),
                start: horizontalMovement(edge) ? event.clientX : event.clientY,
              };
              setPreview({ edge, margins: frame.margins });
            }}
            onPointerMove={(event) => {
              const drag = active.current;
              if (drag?.pointerId !== event.pointerId || drag.edge !== edge) return;
              setPreview({
                edge,
                margins: { ...drag.original, [edge]: updatedMargin(event, drag) },
              });
            }}
            onPointerUp={(event) => {
              const drag = active.current;
              if (drag?.pointerId !== event.pointerId || drag.edge !== edge) return;
              const next = updatedMargin(event, drag);
              cancel();
              if (next !== drag.original[edge]) onCommit({ ...drag.original, [edge]: next });
            }}
            onLostPointerCapture={cancel}
            onPointerCancel={cancel}
            onKeyDown={(event) => {
              if (event.key === "Escape" && active.current) {
                event.stopPropagation();
                cancel();
                return;
              }
              if (active.current) return;
              const keys = horizontalMovement(edge)
                ? ["ArrowLeft", "ArrowRight"]
                : ["ArrowUp", "ArrowDown"];
              const key = keys.indexOf(event.key);
              if (key < 0) return;
              event.preventDefault();
              event.stopPropagation();
              const value = distanceAfterMove(
                margins[edge],
                (key ? 1 : -1) * direction(edge) * (event.shiftKey ? 1 : 0.1),
              );
              if (value !== margins[edge]) onCommit({ ...margins, [edge]: value });
            }}
          >
            <span className="construction-ground-border__grip" />
            {edge === "top" && <span className="construction-ground-border__name">Map border</span>}
            {preview?.edge === edge && (
              <span className="construction-ground-border__distance">
                {formatLength(margins[edge], units)}
              </span>
            )}
          </button>
        ))}
      </div>
    </Html>
  );
}
