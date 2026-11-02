import { planPointToWorld, pointInsidePolygon, worldPointToPlan } from "../geometry";

import type { FloorSpec, PlanPoint, WallJunctionSpec, WallSpec } from "../types";
import { Horizontal, WallPlanFloor } from "./architecture-geometry-contract";

export const normalize = ([x, z]: Horizontal): Horizontal => {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
};

export const wallFrame = (wall: WallSpec, floor: WallPlanFloor) => {
  const from = planPointToWorld(wall.from, floor.coordinates);
  const to = planPointToWorld(wall.to, floor.coordinates);
  const direction = normalize([to[0] - from[0], to[1] - from[1]]);
  return {
    from,
    to,
    direction,
    normal: [-direction[1], direction[0]] as Horizontal,
    length: Math.hypot(to[0] - from[0], to[1] - from[1]),
  };
};

export const pointInsideFloorFootprint = (candidate: PlanPoint, floor: WallPlanFloor) =>
  (floor.footprintRegions ?? [floor.footprint]).some((region) =>
    pointInsidePolygon(candidate, region),
  );

export const wallExteriorNormal = (wall: WallSpec, floor: WallPlanFloor): Horizontal | null => {
  if (wall.classification !== "exterior") return null;
  const frame = wallFrame(wall, floor);
  const center: Horizontal = [(frame.from[0] + frame.to[0]) / 2, (frame.from[1] + frame.to[1]) / 2];
  const offset = Math.max(wall.thicknessMeters, 0.08) * 0.75;
  const plus = worldPointToPlan(
    { x: center[0] + frame.normal[0] * offset, z: center[1] + frame.normal[1] * offset },
    floor.coordinates,
  );
  const minus = worldPointToPlan(
    { x: center[0] - frame.normal[0] * offset, z: center[1] - frame.normal[1] * offset },
    floor.coordinates,
  );
  const plusInside = pointInsideFloorFootprint(plus, floor);
  const minusInside = pointInsideFloorFootprint(minus, floor);
  if (plusInside !== minusInside)
    return plusInside ? [-frame.normal[0], -frame.normal[1]] : frame.normal;
  if (plusInside) return null;
  // Outside the building, use the platform perimeter to orient parapets and side walls.
  const onPlatform = (point: PlanPoint) =>
    (floor.outdoorPlatforms ?? []).some((platform) => pointInsidePolygon(point, platform.polygon));
  const plusOnPlatform = onPlatform(plus);
  if (plusOnPlatform === onPlatform(minus)) return null;
  return plusOnPlatform ? [-frame.normal[0], -frame.normal[1]] : frame.normal;
};

export const junctionArmHalfLength = (junction: WallJunctionSpec, floor: FloorSpec) => {
  const participating = floor.walls.filter((wall) => junction.wallIds.includes(wall.id));
  return Math.max(...participating.map((wall) => wall.thicknessMeters), 0.12) * 0.6;
};
