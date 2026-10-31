import { closedOpeningCoverClearance } from "@cabane/catalog/architecture";
import { exteriorWindowPlacement } from "./exterior-window-placement";
import {
  pointInsidePolygon,
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type PlanPoint,
  type SceneItemSize,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { placementCandidate } from "./placement-candidate";

const isWindowFitOpening = (
  opening: FloorSpec["openings"][number],
  openingTypes: readonly ("window" | "sliding-glass-door")[],
) => {
  if (opening.kind === "window") return openingTypes.includes("window");
  return (
    openingTypes.includes("sliding-glass-door") &&
    opening.kind === "door" &&
    opening.operation === "sliding" &&
    opening.variant === "full-glass"
  );
};

export interface WindowPlacement {
  openingId: string;
  roomName: string;
  placement: Extract<ItemPlacement, { kind: "wall" }>;
  size: SceneItemSize;
  distanceMeters: number;
}

/** Produces ordinary wall placements: aligning never changes the architecture. */
export function windowPlacements(
  definition: SceneModelEditorDescriptor,
  floor: FloorSpec,
  at: PlanPoint,
  requestedSize?: SceneItemSize,
): WindowPlacement[] {
  const fit = definition.windowFit;
  if (!fit) return [];
  const scale = floor.coordinates.metersPerPlanUnit;
  const openingTypes = fit.openingTypes ?? ["window"];
  const candidates: WindowPlacement[] = [];
  for (const opening of floor.openings) {
    if (!isWindowFitOpening(opening, openingTypes)) continue;
    const exterior = fit.mounting === "exterior-recessed";
    const sillInset = exterior
      ? (closedOpeningCoverClearance(opening, "left")?.sillInsetMeters ?? 0)
      : 0;
    const size: SceneItemSize = requestedSize ?? [
      (opening.widthPlanUnits * scale) / fit.openingWidthRatio,
      (opening.openingHeightMeters - sillInset) / fit.openingHeightRatio,
      definition.defaultSize[2],
    ];
    const ratios = size.map((value, axis) => value / definition.defaultSize[axis]);
    const scaledDefinition = {
      ...definition,
      defaultSize: size,
      bounds: {
        min: definition.bounds.min.map(
          (value, axis) => value * ratios[axis],
        ) as unknown as SceneItemSize,
        max: definition.bounds.max.map(
          (value, axis) => value * ratios[axis],
        ) as unknown as SceneItemSize,
      },
    };
    const elevation =
      opening.sillHeightMeters + opening.openingHeightMeters - size[1] * fit.openingHeightRatio;
    for (const face of ["left", "right"] as const) {
      const candidate = placementCandidate({ definition: scaledDefinition }, floor, {
        at,
        kind: "wall",
        wallId: opening.wallId,
        face,
        raw: true,
        offset: opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2,
        elevation: Math.abs(elevation) < 1e-10 ? 0 : elevation,
      });
      if (candidate.placement?.kind !== "wall") continue;
      const exteriorCandidate = exterior
        ? exteriorWindowPlacement(candidate.placement, opening, floor, fit.depthOffsetMeters)
        : null;
      if (exterior && !exteriorCandidate) continue;
      const placement = exteriorCandidate?.placement ?? {
        ...candidate.placement,
        depthOffsetMeters: Math.max(candidate.placement.depthOffsetMeters, fit.depthOffsetMeters),
      };
      const transform = resolveItemTransform(placement, floor);
      const resolvedAt: PlanPoint = [
        transform.position[0] / scale + floor.coordinates.origin[0],
        transform.position[2] / scale + floor.coordinates.origin[1],
      ];
      const roomName =
        exteriorCandidate?.roomName ??
        floor.rooms.find((room) => pointInsidePolygon(resolvedAt, room.polygon))?.name ??
        "Window";
      candidates.push({
        openingId: opening.id,
        roomName,
        placement,
        size,
        distanceMeters: Math.hypot(resolvedAt[0] - at[0], resolvedAt[1] - at[1]) * scale,
      });
    }
  }
  return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
