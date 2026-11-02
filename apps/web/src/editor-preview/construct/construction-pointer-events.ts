import { type ThreeEvent } from "@react-three/fiber";

import { FloorEditorTool, PlanPoint } from "@cabane/engine";

import { Plane, Vector3 } from "three";

import { type SelectDragActivation } from "./select-drag-activation";

export type PointerEvent3D = ThreeEvent<PointerEvent>;

export type OpeningTool = Extract<FloorEditorTool, "door" | "window" | "passage" | "niche">;

export type PointerCaptureTarget = {
  setPointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
  releasePointerCapture?: (pointerId: number) => void;
};

export type CapturedSelectDrag = SelectDragActivation & {
  target: PointerCaptureTarget;
};

export type MarqueeDrag = {
  from: PlanPoint;
  to: PlanPoint;
  clientFrom: readonly [number, number];
  clientTo: readonly [number, number];
  pointerId: number;
  target: PointerCaptureTarget;
};

export const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

export const samePlanPoint = (left: PlanPoint, right: PlanPoint) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= 1e-7;

export const stopPointer = (event: PointerEvent3D) => {
  event.stopPropagation();
};

export const capturePointer = (event: PointerEvent3D) => {
  event.stopPropagation();
  (event.target as PointerCaptureTarget | null)?.setPointerCapture?.(event.pointerId);
};

export const releasePointer = (event: PointerEvent3D) => {
  event.stopPropagation();
  const target = event.target as PointerCaptureTarget | null;
  if (target?.hasPointerCapture?.(event.pointerId) !== false) {
    target?.releasePointerCapture?.(event.pointerId);
  }
};

const drawingTools: readonly FloorEditorTool[] = [
  "wall",
  "virtual-wall",
  "hedge",
  "pool",
  "platform",
];
export const isConstructionDrawingTool = (tool: FloorEditorTool) => drawingTools.includes(tool);
