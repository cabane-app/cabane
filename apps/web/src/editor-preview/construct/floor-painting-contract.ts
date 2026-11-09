import type { FloorFinishSpec, FloorEditorTool } from "@cabane/engine";

export type FloorPaintTarget = "room" | "custom-area" | "elevation-area" | "outdoor-platform";

export interface FloorPaintingInspector {
  finish: FloorFinishSpec;
  target: FloorPaintTarget;
  drawingActive: boolean;
  drawingError: string | null;
  onFinishChange: (finish: FloorFinishSpec) => void;
  onTargetChange: (target: FloorPaintTarget) => void;
  onCancelDrawing: () => void;
}

export const isAreaPaintTarget = (target: FloorPaintTarget, tool: FloorEditorTool = "floor") =>
  tool === "floor" && (target === "custom-area" || target === "elevation-area");

export const openingToolFor = (tool: FloorEditorTool) =>
  tool === "door" || tool === "window" || tool === "passage" || tool === "niche" ? tool : null;
