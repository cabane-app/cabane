import {
  nicheDepthLimit,
  openingCutTop,
  type DoorConfiguration,
  type FloorEditorDraft,
  type PlanPoint,
} from "@cabane/engine";
import { openingPlacementIsValid } from "./drag-geometry";
import type { OpeningTool } from "./construction-pointer-events";

export function openingToolDimensions(kind: OpeningTool, door: DoorConfiguration, scale: number) {
  return {
    kind,
    ...(kind === "door" ? { variant: door.variant } : {}),
    widthPlanUnits:
      (kind === "door"
        ? door.widthMeters
        : kind === "window"
          ? 1.2
          : kind === "niche"
            ? 0.6
            : 0.9) / scale,
    openingHeightMeters:
      kind === "door" ? door.heightMeters : kind === "window" ? 1.2 : kind === "niche" ? 1 : 2.04,
    sillHeightMeters: kind === "window" ? 0.9 : kind === "niche" ? 0.1 : 0,
  };
}

export function openingPlacementPreview(
  draft: FloorEditorDraft,
  point: PlanPoint | null,
  placement: { wallId: string; offsetPlanUnits: number } | null,
  dimensions: ReturnType<typeof openingToolDimensions>,
) {
  if (!placement) return null;
  const wall = draft.walls.find((wall) => wall.id === placement.wallId);
  if (!wall) return null;
  const { kind } = dimensions;
  const wallTop =
    (wall.heightMeters ?? draft.defaultWallHeightMeters) - (kind === "niche" ? 0.002 : 0);
  const side =
    point &&
    (wall.to[0] - wall.from[0]) * (point[1] - wall.from[1]) -
      (wall.to[1] - wall.from[1]) * (point[0] - wall.from[0]) <
      0
      ? ("right" as const)
      : ("left" as const);
  return {
    ...placement,
    side,
    valid:
      (kind !== "niche" || nicheDepthLimit(draft, wall.id) >= 0.01) &&
      openingCutTop(dimensions, wallTop) <= wallTop &&
      openingPlacementIsValid({
        draft,
        wallId: wall.id,
        offsetPlanUnits: placement.offsetPlanUnits,
        widthPlanUnits: dimensions.widthPlanUnits,
        sillHeightMeters: dimensions.sillHeightMeters,
        kind,
      }),
  };
}
