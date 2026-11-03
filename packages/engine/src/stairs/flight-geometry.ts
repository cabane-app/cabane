import { floorSupportPolygons } from "../outdoor-platforms/platform-geometry";
import { planPointToWorld, worldPointToPlan } from "../geometry";
import type { Polygon } from "../types";
import type { BuildingGeometry, StairSpec } from "./types";
import { SPIRAL_CORE_RADIUS_METERS } from "./spiral-geometry";
import { resolveStairConnection } from "./stair-connection";
import { stairShapeGeometry } from "./stair-shape-geometry";

export const STAIR_LANDING_METERS = 0.6;
export const deriveStairFlight = (building: BuildingGeometry, stair: StairSpec) => {
  if (![...stair.at, stair.rotationYRadians].every(Number.isFinite)) return null;
  const dimensions =
    stair.shape === "spiral"
      ? [stair.diameterMeters, stair.totalTurnDegrees]
      : stair.shape === "l-shaped" || stair.shape === "u-shaped"
        ? [stair.widthMeters, stair.lowerRunMeters, stair.upperRunMeters]
        : [stair.widthMeters, stair.runMeters];
  if (!dimensions.every((n) => Number.isFinite(n) && n > 0)) return null;
  if (
    stair.shape === "spiral" &&
    (stair.diameterMeters <= 2 * SPIRAL_CORE_RADIUS_METERS ||
      stair.totalTurnDegrees > 360 ||
      !["clockwise", "counterclockwise"].includes(stair.direction))
  )
    return null;
  if (
    (stair.shape === "l-shaped" || stair.shape === "u-shaped") &&
    !["left", "right"].includes(stair.turn)
  )
    return null;
  const connection = resolveStairConnection(building, stair);
  if (!connection) return null;
  const { baseElevationMeters, riseMeters } = connection;
  if (!Number.isFinite(riseMeters) || riseMeters <= 0) return null;
  const stepCount = Math.max(2, Math.min(512, Math.ceil(riseMeters / 0.2)));
  const [x, z] = planPointToWorld(stair.at, building.coordinates);
  const forward = [Math.sin(stair.rotationYRadians), Math.cos(stair.rotationYRadians)] as const;
  const side = [forward[1], -forward[0]] as const;
  const geometry = stairShapeGeometry(stair, riseMeters, stepCount);
  const world = (p: readonly [number, number]): [number, number] => [
    x + side[0] * p[0] + forward[0] * p[1],
    z + side[1] * p[0] + forward[1] * p[1],
  ];
  const plan = (p: readonly [number, number]) =>
    worldPointToPlan({ x: p[0], z: p[1] }, building.coordinates);
  const path = geometry.path.map((p) => {
    const [x, z] = world([p.x, p.z]);
    return { x, z, elevation: p.elevation };
  });
  // Analytical tangents keep a complete spiral's coincident entrances exact.
  const tangent = (upper: boolean): readonly [number, number] => {
    if (stair.shape === "spiral") {
      const sign = stair.direction === "clockwise" ? 1 : -1,
        a = upper ? (sign * stair.totalTurnDegrees * Math.PI) / 180 : 0;
      return [
        sign * (-Math.sin(a) * side[0] + Math.cos(a) * forward[0]),
        sign * (-Math.sin(a) * side[1] + Math.cos(a) * forward[1]),
      ];
    }
    const a = upper ? path[path.length - 2] : path[0],
      b = upper ? path[path.length - 1] : path[1];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    return [(b.x - a.x) / d, (b.z - a.z) / d];
  };
  const entranceForward = tangent(false),
    exitForward = tangent(true);
  const landing = (upper: boolean): Polygon => {
    const p = upper ? path[path.length - 1] : path[0],
      f = upper ? exitForward : entranceForward,
      w = geometry.widthMeters / 2;
    const length =
      stair.shape === "spiral"
        ? Math.sqrt(
            (stair.diameterMeters / 2) ** 2 -
              ((stair.diameterMeters / 2 + SPIRAL_CORE_RADIUS_METERS) / 2) ** 2,
          ) + STAIR_LANDING_METERS
        : STAIR_LANDING_METERS;
    const d = upper ? length : -length;
    return [
      [p.x - f[1] * w, p.z + f[0] * w],
      [p.x + f[1] * w, p.z - f[0] * w],
      [p.x + f[0] * d + f[1] * w, p.z + f[1] * d - f[0] * w],
      [p.x + f[0] * d - f[1] * w, p.z + f[1] * d + f[0] * w],
    ].map((p) => plan(p as [number, number])) as unknown as Polygon;
  };
  const footprintWorld = geometry.footprint.map(world);
  return {
    ...stair,
    ...connection,
    coordinates: building.coordinates,
    shape: stair.shape ?? "straight",
    spec: stair,
    baseElevationMeters,
    riseMeters,
    forward,
    side,
    stepCount,
    widthMeters: geometry.widthMeters,
    runMeters: geometry.runMeters,
    originWorld: [x, z] as const,
    startWorld: [path[0].x, path[0].z] as const,
    path,
    entranceForward,
    exitForward,
    upperSupportWorld: building.floors
      .filter((floor) => floor.id === connection.upperFloorId)
      .flatMap((floor) =>
        floorSupportPolygons(floor).map((polygon) =>
          polygon.map((p) => planPointToWorld(p, building.coordinates)),
        ),
      ),
    footprintWorld,
    footprint: footprintWorld.map(plan) as unknown as Polygon,
    treads: geometry.treads.map((t) => ({ ...t, polygon: t.polygon.map(world) })),
    lowerLanding: landing(false),
    upperLanding: landing(true),
  };
};
export type StairFlight = NonNullable<ReturnType<typeof deriveStairFlight>>;
export const deriveStairApertures = (building: BuildingGeometry) =>
  building.stairs.flatMap((stair) => {
    const flight = deriveStairFlight(building, stair);
    return flight && !stair.terrain
      ? [
          {
            stairId: stair.id,
            floorId: stair.lowerFloorId,
            surface: "ceiling" as const,
            polygon: flight.footprint,
          },
          {
            stairId: stair.id,
            floorId: stair.upperFloorId,
            surface: "floor" as const,
            polygon: flight.footprint,
          },
        ]
      : [];
  });
