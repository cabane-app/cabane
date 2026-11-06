import { planPointToWorld, pointInsidePolygon, slopedCeilingHeightAtPoint } from "../geometry";
import type { FloorSpec, PlanPoint } from "../types";
import { pointOnPolygonBoundary } from "../validation/geometry";
import type { ItemPlacement } from "./types";

export interface ResolvedItemTransform {
  position: readonly [number, number, number];
  rotationYRadians: number;
}

/** Find the first ceiling surface above this room position. */
export function ceilingSupportHeight(
  floor: Pick<FloorSpec, "ceilings" | "defaultCeilingHeightMeters">,
  roomId: string,
  at: PlanPoint,
): number | undefined {
  const ceilings = floor.ceilings ?? [];
  const flat = ceilings.find(
    (ceiling) => ceiling.kind === "flat" && ceiling.roomIds.includes(roomId),
  );
  let height = flat?.kind === "flat" ? flat.heightMeters : undefined;
  let sloped = false;
  for (const ceiling of ceilings) {
    if (ceiling.kind !== "sloped" || !ceiling.roomIds.includes(roomId)) continue;
    sloped = true;
    for (const plane of ceiling.planes) {
      if (pointInsidePolygon(at, plane.boundary) || pointOnPolygonBoundary(at, plane.boundary)) {
        height = Math.min(height ?? Infinity, slopedCeilingHeightAtPoint(at, plane));
      }
    }
  }
  return height ?? (sloped ? undefined : floor.defaultCeilingHeightMeters);
}

export const resolveItemTransform = (
  placement: ItemPlacement,
  floor: Pick<FloorSpec, "coordinates" | "walls" | "ceilings" | "defaultCeilingHeightMeters">,
): ResolvedItemTransform => {
  if (placement.kind === "absolute") {
    const [x, z] = planPointToWorld(placement.at, floor.coordinates);
    return {
      position: [x, placement.elevationMeters, z],
      rotationYRadians: placement.rotationYRadians,
    };
  }

  if (placement.kind === "ceiling") {
    const height =
      ceilingSupportHeight(floor, placement.roomId, placement.at) ??
      floor.defaultCeilingHeightMeters;
    const [x, z] = planPointToWorld(placement.at, floor.coordinates);
    return {
      position: [x, height - placement.dropMeters, z],
      rotationYRadians: placement.rotationYRadians,
    };
  }

  const wall = floor.walls.find((candidate) => candidate.id === placement.wallId);
  if (!wall) {
    throw new Error(`Wall ${placement.wallId} does not exist.`);
  }

  const dx = wall.to[0] - wall.from[0];
  const dz = wall.to[1] - wall.from[1];
  const planLength = Math.hypot(dx, dz);
  if (planLength === 0) {
    throw new Error(`Wall ${placement.wallId} has no length.`);
  }

  const ux = dx / planLength;
  const uz = dz / planLength;
  const rightNormalX = -uz;
  const rightNormalZ = ux;
  const side = placement.face === "left" ? -1 : 1;
  const normalX = rightNormalX * side;
  const normalZ = rightNormalZ * side;
  const normalMeters =
    Math.round((wall.thicknessMeters / 2 + placement.depthOffsetMeters) * 1e12) / 1e12;
  const normalPlan = normalMeters / floor.coordinates.metersPerPlanUnit;
  const at = [
    wall.from[0] + ux * placement.offsetFromWallStartPlanUnits + normalX * normalPlan,
    wall.from[1] + uz * placement.offsetFromWallStartPlanUnits + normalZ * normalPlan,
  ] as const;
  const [x, z] = planPointToWorld(at, floor.coordinates);

  return {
    position: [x, placement.elevationMeters, z],
    rotationYRadians:
      Math.atan2(rightNormalX, rightNormalZ) +
      (placement.face === "left" ? Math.PI : 0) +
      placement.rotationOffsetRadians,
  };
};
