import { openingPlanSymbol } from "./opening-plan-symbol";
import {
  editorWallAttachments,
  type EditorWallAttachment,
  planPointToWorld,
  type FloorEditorDraft,
} from "@cabane/engine";
import { memo, useMemo } from "react";
import { PlanStrokeBatch, type BatchedPlanStroke } from "./PlanStrokeBatch";
import { ConstructionPlanWallJoints } from "./ConstructionPlanWallJoints";

/** Draft geometry is also used during pointer previews, including unfinished walls. */
export const ConstructionPlanWalls = memo(function ConstructionPlanWalls({
  draft,
  attachments = editorWallAttachments(draft),
}: {
  draft: FloorEditorDraft;
  attachments?: readonly EditorWallAttachment[];
}) {
  const strokes = useMemo(() => {
    const result: BatchedPlanStroke[] = [];
    for (const wall of draft.walls) {
      const from = planPointToWorld(wall.from, draft.coordinates);
      const to = planPointToWorld(wall.to, draft.coordinates);
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (length < 0.0001) continue;
      const at = (distance: number): readonly [number, number] => [
        from[0] + ((to[0] - from[0]) * distance) / length,
        from[1] + ((to[1] - from[1]) * distance) / length,
      ];
      if (wall.virtual) {
        for (let start = 0; start < length; start += 0.3) {
          result.push({
            from: at(start),
            to: at(Math.min(length, start + 0.18)),
            color: "#596057",
          });
        }
        continue;
      }
      const openings = attachments
        .filter((opening) => opening.wallId === wall.id)
        .sort((a, b) => a.offsetPlanUnits - b.offsetPlanUnits);
      const scale = draft.coordinates.metersPerPlanUnit;
      const spans: Array<readonly [number, number]> = [];
      let cursor = 0;
      for (const opening of openings) {
        const start = Math.max(0, Math.min(length, opening.offsetPlanUnits * scale));
        if (start > cursor) spans.push([cursor, start]);
        cursor = Math.max(
          cursor,
          Math.min(length, (opening.offsetPlanUnits + opening.widthPlanUnits) * scale),
        );
      }
      if (cursor < length) spans.push([cursor, length]);
      const thickness = wall.thicknessMeters ?? draft.interiorWallThicknessMeters;
      for (const [start, end] of spans)
        result.push({
          from: at(start),
          to: at(end),
          width: thickness,
          color: "#596057",
          elevation: 0.035,
        });
      for (const opening of openings) {
        const width = opening.widthPlanUnits * scale;
        const origin = at(opening.offsetPlanUnits * scale);
        const ux = (to[0] - from[0]) / length,
          uz = (to[1] - from[1]) / length;
        const world = (point: readonly [number, number]): readonly [number, number] => [
          origin[0] + ux * point[0] - uz * point[1],
          origin[1] + uz * point[0] + ux * point[1],
        ];
        for (const stroke of openingPlanSymbol(opening, width, thickness))
          result.push({ ...stroke, from: world(stroke.from), to: world(stroke.to) });
      }
    }
    return result;
  }, [draft.walls, attachments, draft.coordinates, draft.interiorWallThicknessMeters]);
  return (
    <group name="construction-plan-walls">
      <ConstructionPlanWallJoints draft={draft} />
      <PlanStrokeBatch name="wall-and-opening-strokes" strokes={strokes} />
    </group>
  );
});
