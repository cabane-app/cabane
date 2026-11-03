import { omitUndefinedProperties } from "@cabane/engine";
import {
  deriveStairFlight,
  connectStairToTerrain,
  reverseStairRoute,
  stairRouteEnd,
  resolveStairConnection,
  worldPointToPlan,
  type FloorCoordinates,
  type StairSpec,
  type LShapedStairSpec,
  type UShapedStairSpec,
  type StairShape,
  type HomeProject,
  type StairFlight,
} from "@cabane/engine";

export interface StairPlacementPoint {
  x: number;
  z: number;
}
const rounded = (n: number) => Number(n.toFixed(2));
/** Straight endpoints; spiral center/radius; L-shaped entrance/landing center. */
export function stairFromEndpoints(
  stair: StairSpec,
  coordinates: FloorCoordinates,
  start: StairPlacementPoint,
  end: StairPlacementPoint,
): StairSpec | null {
  const dx = end.x - start.x,
    dz = end.z - start.z,
    run = Math.hypot(dx, dz);
  if (!Number.isFinite(run) || run < 0.1) return null;
  const at = worldPointToPlan(start, coordinates);
  if (stair.shape === "spiral")
    return {
      ...stair,
      at,
      diameterMeters: rounded(2 * run),
      rotationYRadians: -Math.atan2(dz, dx),
    };
  if (stair.shape === "l-shaped" || stair.shape === "u-shaped")
    return run - stair.widthMeters / 2 >= 0.1
      ? {
          ...stair,
          at,
          lowerRunMeters: rounded(run - stair.widthMeters / 2),
          rotationYRadians: Math.atan2(dx, dz),
        }
      : null;
  return { ...stair, at, runMeters: rounded(run), rotationYRadians: Math.atan2(dx, dz) };
}
export function stairFromCorner(
  stair: LShapedStairSpec | UShapedStairSpec,
  coordinates: FloorCoordinates,
  start: StairPlacementPoint,
  corner: StairPlacementPoint,
  end: StairPlacementPoint,
): LShapedStairSpec | UShapedStairSpec | null {
  const first = stairFromEndpoints(stair, coordinates, start, corner);
  if (!first || (first.shape !== "l-shaped" && first.shape !== "u-shaped")) return null;
  const across =
    (end.x - corner.x) * Math.cos(first.rotationYRadians) -
    (end.z - corner.z) * Math.sin(first.rotationYRadians);
  const along =
    (end.x - corner.x) * Math.sin(first.rotationYRadians) +
    (end.z - corner.z) * Math.cos(first.rotationYRadians);
  const run =
    first.shape === "u-shaped"
      ? -along - stair.widthMeters / 2
      : Math.abs(across) - stair.widthMeters / 2;
  return run >= 0.1
    ? { ...first, upperRunMeters: rounded(run), turn: across >= 0 ? "right" : "left" }
    : null;
}
export type StairEditHandle =
  "body" | "bottom" | "top" | "left" | "right" | "corner" | "diameter" | "rotation";
export function editStairFromPoint(
  stair: StairSpec,
  coordinates: FloorCoordinates,
  start: StairPlacementPoint,
  grab: StairPlacementPoint,
  point: StairPlacementPoint,
  handle: StairEditHandle,
): StairSpec | null {
  const forward = { x: Math.sin(stair.rotationYRadians), z: Math.cos(stair.rotationYRadians) };
  if (handle === "body")
    return {
      ...stair,
      at: worldPointToPlan(
        { x: start.x + point.x - grab.x, z: start.z + point.z - grab.z },
        coordinates,
      ),
    };
  if (stair.shape === "spiral") {
    const radius = Math.hypot(point.x - start.x, point.z - start.z);
    if (radius <= 0.1) return null;
    return handle === "rotation"
      ? { ...stair, rotationYRadians: -Math.atan2(point.z - start.z, point.x - start.x) }
      : { ...stair, diameterMeters: rounded(radius * 2) };
  }
  if (stair.shape === "l-shaped" || stair.shape === "u-shaped") {
    const corner = {
      x: start.x + forward.x * (stair.lowerRunMeters + stair.widthMeters / 2),
      z: start.z + forward.z * (stair.lowerRunMeters + stair.widthMeters / 2),
    };
    if (handle === "bottom") return stairFromEndpoints(stair, coordinates, point, corner);
    if (handle === "corner") return stairFromEndpoints(stair, coordinates, start, point);
    if (handle === "top") return stairFromCorner(stair, coordinates, start, corner, point);
  } else {
    const end = {
      x: start.x + forward.x * stair.runMeters,
      z: start.z + forward.z * stair.runMeters,
    };
    if (handle === "bottom") return stairFromEndpoints(stair, coordinates, point, end);
    if (handle === "top") return stairFromEndpoints(stair, coordinates, start, point);
  }
  const across = (point.x - start.x) * forward.z - (point.z - start.z) * forward.x;
  const widthMeters = rounded(Math.abs(across) * 2);
  return widthMeters >= 0.1 ? { ...stair, widthMeters } : null;
}
export function convertStairShape(
  building: HomeProject,
  stair: StairSpec,
  shape: StairShape,
): StairSpec {
  if ((stair.shape ?? "straight") === shape) return stair;
  if (stair.terrain?.end === "lower") {
    const reversed = reverseStairRoute(stair, building.coordinates);
    if (!reversed.terrain) return stair;
    const source = { ...reversed, terrain: { ...stair.terrain, end: "upper" as const } };
    return connectStairToTerrain(building, convertStairShape(building, source, shape));
  }
  const flight = deriveStairFlight(building, stair);
  const start = stairRouteEnd(stair, building.coordinates, false);
  const entrance = flight?.startWorld ?? [start.x, start.z];
  const base = {
    id: stair.id,
    railings: stair.railings,
    style: stair.style,
    ...(stair.terrain
      ? { terrain: stair.terrain }
      : { lowerFloorId: stair.lowerFloorId, upperFloorId: stair.upperFloorId }),
    at: worldPointToPlan({ x: entrance[0], z: entrance[1] }, building.coordinates),
    rotationYRadians: stair.rotationYRadians,
  };
  const rise = Math.abs(resolveStairConnection(building, stair)?.riseMeters ?? 1);
  if (shape === "spiral")
    return omitUndefinedProperties({
      ...base,
      shape,
      at: worldPointToPlan(
        {
          x: entrance[0] - 0.55 * Math.cos(base.rotationYRadians),
          z: entrance[1] + 0.55 * Math.sin(base.rotationYRadians),
        },
        building.coordinates,
      ),
      diameterMeters: 2,
      totalTurnDegrees: 360,
      direction: "clockwise",
    });
  if (shape === "l-shaped" || shape === "u-shaped")
    return omitUndefinedProperties({
      ...base,
      shape,
      widthMeters: 1,
      lowerRunMeters: rounded(rise * 0.75),
      upperRunMeters: rounded(rise * 0.75),
      turn: "right",
    });
  return omitUndefinedProperties({
    ...base,
    shape,
    widthMeters: 1,
    runMeters: rounded(rise * 1.5),
  });
}
export function stairEditHandles(
  flight: StairFlight,
): { handle: StairEditHandle; at: [number, number, number] }[] {
  const p = (x: number, z: number): [number, number, number] => [x, 0.25, z];
  const start = flight.path[0],
    end = flight.path[flight.path.length - 1];
  if (flight.spec.shape === "spiral") {
    const [x, z] = flight.originWorld,
      r = flight.spec.diameterMeters / 2;
    return [
      { handle: "diameter", at: p(x - flight.side[0] * r, z - flight.side[1] * r) },
      { handle: "rotation", at: p(x + flight.side[0] * r, z + flight.side[1] * r) },
    ];
  }
  const run =
    flight.spec.shape === "l-shaped" || flight.spec.shape === "u-shaped"
      ? flight.spec.lowerRunMeters
      : flight.runMeters;
  return [
    { handle: "bottom", at: p(start.x, start.z) },
    { handle: "top", at: p(end.x, end.z) },
    ...([-1, 1] as const).map((sign) => ({
      handle: (sign === -1 ? "left" : "right") as StairEditHandle,
      at: p(
        start.x + (flight.forward[0] * run) / 2 + (flight.side[0] * sign * flight.widthMeters) / 2,
        start.z + (flight.forward[1] * run) / 2 + (flight.side[1] * sign * flight.widthMeters) / 2,
      ),
    })),
    ...(flight.spec.shape === "l-shaped" || flight.spec.shape === "u-shaped"
      ? [{ handle: "corner" as const, at: p(flight.path[2].x, flight.path[2].z) }]
      : []),
  ];
}
