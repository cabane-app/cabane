import {
  resolveOpeningOrientation,
  type EditorWallAttachment as EditorOpening,
  type OpeningSpec,
  type PlanPoint,
} from "@cabane/engine";

export interface OpeningPlanStroke {
  from: PlanPoint;
  to: PlanPoint;
  color: string;
  width?: number;
}

/** The same wall-local symbol feeds the Construct canvas and Details diagram. */
export function openingPlanSymbol(
  opening: EditorOpening | OpeningSpec,
  width: number,
  thickness: number,
): OpeningPlanStroke[] {
  const strokes: OpeningPlanStroke[] = [];
  const line = (from: PlanPoint, to: PlanPoint, color: string, strokeWidth?: number) => {
    strokes.push({ from, to, color, ...(strokeWidth === undefined ? {} : { width: strokeWidth }) });
  };
  line([0, -thickness / 2], [0, thickness / 2], "#596057");
  line([width, -thickness / 2], [width, thickness / 2], "#596057");
  if (opening.kind === "niche") {
    const face = opening.side === "left" ? thickness / 2 : -thickness / 2;
    const back = face - Math.sign(face) * opening.depthMeters;
    line([0, face], [0, back], "#94765e");
    line([0, back], [width, back], "#94765e");
    line([width, back], [width, face], "#94765e");
    line([0, -face], [width, -face], "#596057");
    return strokes;
  }
  if (opening.kind === "passage") return strokes;
  if (opening.kind === "door" && opening.operation === "roll-up") {
    for (const z of [-0.035, 0.035]) line([0, z], [width, z], "#7d8581", 0.025);
    return strokes;
  }
  const orientation = resolveOpeningOrientation(opening);
  const color = opening.kind === "window" ? "#789a98" : "#94765e";
  if (opening.kind === "window") {
    for (const side of [-1, 1])
      line([0, side * thickness * 0.23], [width, side * thickness * 0.23], color);
    if (opening.operation === "fixed") return strokes;
  }
  for (const leaf of orientation.leaves) {
    const radius = width * leaf.widthRatio;
    if (opening.operation === "sliding") {
      const z = orientation.sideSign * (thickness / 2 + 0.06);
      const start = width * leaf.startRatio;
      line([start, z], [start + radius, z], color, 0.04);
      const center = start + radius / 2;
      const tip = center + leaf.slideSign * radius * 0.38;
      const arrowZ = z + orientation.sideSign * 0.15;
      line([center - leaf.slideSign * radius * 0.25, arrowZ], [tip, arrowZ], color);
      for (const side of [-1, 1])
        line([tip - leaf.slideSign * radius * 0.13, arrowZ + side * 0.07], [tip, arrowZ], color);
    } else if (opening.operation === "bifold") {
      const hinge = leaf.pivotRatio * width;
      const half = radius / 2;
      const fold: PlanPoint = [
        hinge + leaf.extentSign * half * 0.25,
        orientation.sideSign * half * 0.97,
      ];
      line([hinge, 0], fold, color, 0.04);
      line(fold, [hinge + leaf.extentSign * half * 0.5, 0], color, 0.04);
    } else {
      const hinge = leaf.pivotRatio * width;
      const angle = opening.kind === "window" ? Math.PI / 4 : Math.PI / 2;
      const arc = Array.from({ length: 17 }, (_, index): PlanPoint => [
        hinge + leaf.extentSign * radius * Math.cos((index * angle) / 16),
        orientation.sideSign * radius * Math.sin((index * angle) / 16),
      ]);
      line([hinge, 0], arc[16], color);
      arc.slice(1).forEach((point, index) => line(arc[index], point, color, 0.015));
    }
  }
  return strokes;
}
