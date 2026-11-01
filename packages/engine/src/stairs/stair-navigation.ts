import { createTerrainSurface } from "../terrain/terrain-surface";
import { pointOnFloorSupport } from "../outdoor-platforms/platform-geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import { WALK_MAX_STEP_METERS } from "../navigation/walk-navigation-contract";
import { resolveTerrainWalking } from "../navigation/terrain-walking";
import { prepareWalkColliders } from "../navigation/prepared-walk-colliders";
import { resolveItemTransform } from "../home-project/placements";
import { deriveFloorLevels } from "../building/floor-levels";
import { planPointToWorld, pointInsidePolygon, worldPointToPlan } from "../geometry";
import {
  WALK_PLAYER_RADIUS,
  deriveWalkColliders,
  isWalkPointClear,
  resolveCircleMovement,
  safeSpawnPoseForRoom,
  walkCollidersForVerticalRange,
  type WalkPoint,
  type BoxWalkCollider,
  type WalkVerticalRange,
} from "../navigation";
import { projectStairPath, stairEndCoordinates } from "./path-projection";
import { pointOnPolygonBoundary } from "../validation/geometry";
import { deriveStairFlight, type StairFlight } from "./flight-geometry";
import { stairItemObstacle, type StairModelRegistries } from "./stair-obstacles";
import type { BuildingGeometry } from "./types";
import type { PlanPoint } from "../types";

export interface BuildingWalkPoint extends WalkPoint {
  floorId: string;
  elevation: number;
  stairId?: string;
}
/** Prepared once per architecture revision, with content-aware door/furniture updates. */
export const prepareBuildingWalk = (building: BuildingGeometry) => {
  const levels = deriveFloorLevels(building.floors);
  const terrain = building.home?.apartmentFloor
    ? null
    : createTerrainSurface(building.home?.terrain, building.floors);
  return {
    levels,
    terrain,
    colliders: new Map(
      building.floors.map((floor) => [
        floor.id,
        prepareWalkColliders(
          floor,
          levels.find((level) => level.floorId === floor.id)!.elevationMeters,
          terrain,
        ),
      ]),
    ),
    flights: building.stairs.map((stair) => deriveStairFlight(building, stair)),
  };
};
/** Item bounds on a landing must be checked before the selected floor changes. */
const landingItemColliders = (
  building: BuildingGeometry,
  floor: BuildingGeometry["floors"][number],
  floorElevation: number,
  registries: StairModelRegistries = {},
): BoxWalkCollider[] =>
  building.sceneItems.flatMap((item) => {
    if (item.floorId !== floor.id) return [];
    try {
      const bounds = stairItemObstacle(item, floor, 0, registries);
      if (bounds) {
        if (bounds.bottom > 1.8 || bounds.top < 0.08) return [];
        return [
          {
            kind: "box" as const,
            id: item.id,
            minX: bounds.minX,
            maxX: bounds.maxX,
            minZ: bounds.minZ,
            maxZ: bounds.maxZ,
            minY: floorElevation + bounds.bottom,
            maxY: floorElevation + bounds.top,
          },
        ];
      }
      const transform = resolveItemTransform(item.placement, floor);
      const [x, y, z] = transform.position;
      if (y > 1.8 || y + item.size[1] < 0.08) return [];
      const c = Math.abs(Math.cos(transform.rotationYRadians)),
        s = Math.abs(Math.sin(transform.rotationYRadians));
      const halfX = (item.size[0] * c + item.size[2] * s) / 2;
      const halfZ = (item.size[0] * s + item.size[2] * c) / 2;
      return [
        {
          kind: "box" as const,
          id: item.id,
          minX: x - halfX,
          maxX: x + halfX,
          minZ: z - halfZ,
          maxZ: z + halfZ,
          minY: floorElevation + y,
          maxY: floorElevation + y + item.size[1],
        },
      ];
    } catch {
      return [];
    }
  });
const hasUnsupportedStairAperture = (
  flights: readonly (StairFlight | null)[],
  floorId: string,
  point: PlanPoint,
  exitingStairId?: string,
) =>
  flights.some(
    (flight) =>
      !flight?.terrain &&
      flight?.upperFloorId === floorId &&
      flight.id !== exitingStairId &&
      pointInsidePolygon(point, flight.footprint) &&
      !pointOnPolygonBoundary(point, flight.footprint),
  ) &&
  // Only spiral upper landings render a bridge; other landing polygons need floor underneath.
  !flights.some(
    (flight) =>
      !flight?.terrain &&
      flight?.upperFloorId === floorId &&
      flight.shape === "spiral" &&
      flight.widthMeters >= WALK_PLAYER_RADIUS * 2 &&
      (pointInsidePolygon(point, flight.upperLanding) ||
        pointOnPolygonBoundary(point, flight.upperLanding)),
  );
export const moveBuildingWalker = (
  building: BuildingGeometry,
  pose: BuildingWalkPoint,
  movement: WalkPoint,
  openIds: ReadonlySet<string>,
  furniture: readonly BoxWalkCollider[] = [],
  prepared?: ReturnType<typeof prepareBuildingWalk>,
  registries: StairModelRegistries = {},
  options: {
    verticalRange?: WalkVerticalRange;
    allowUnsupported?: boolean;
    terrainHeight?: (point: WalkPoint) => number | null;
  } = {},
): BuildingWalkPoint => {
  const floor = building.floors.find((f) => f.id === pose.floorId);
  if (!floor) return pose;
  const levels = deriveFloorLevels(building.floors);
  const floorElevation = levels.find((level) => level.floorId === floor.id)!.elevationMeters;
  const flights =
    prepared?.flights ?? building.stairs.map((stair) => deriveStairFlight(building, stair));
  let verticalRange = options.verticalRange;
  const activeFlight = pose.stairId ? flights.find((flight) => flight?.id === pose.stairId) : null;
  // The last step covers a supporting facade below its landing. Keep that wall
  // from catching the player's horizontal radius before their feet reach the slab.
  if (activeFlight?.terrain && verticalRange) {
    for (const upper of [false, true]) {
      const floorId = upper ? activeFlight.upperFloorId : activeFlight.lowerFloorId;
      if (!floorId) continue;
      const end = upper ? activeFlight.path.at(-1)! : activeFlight.path[0];
      const at = stairEndCoordinates(
        pose,
        end,
        upper ? activeFlight.exitForward : activeFlight.entranceForward,
      );
      const elevation = activeFlight.baseElevationMeters + end.elevation;
      if (Math.abs(at.along) <= WALK_PLAYER_RADIUS + 0.2)
        verticalRange = { ...verticalRange, minY: Math.max(verticalRange.minY, elevation + 1e-6) };
    }
  }
  const terrain = prepared
    ? prepared.terrain
    : building.home?.apartmentFloor
      ? null
      : createTerrainSurface(building.home?.terrain, building.floors);
  const floorColliders =
    prepared?.colliders.get(floor.id)?.(openIds, furniture) ??
    deriveWalkColliders(floor, openIds, furniture, floorElevation, terrain);
  const next = resolveCircleMovement(
    pose,
    movement,
    walkCollidersForVerticalRange(
      options.terrainHeight
        ? [
            ...floorColliders,
            ...building.floors
              .filter((other) => other.id !== floor.id)
              .flatMap(
                (other) =>
                  prepared?.colliders.get(other.id)?.(openIds, []) ??
                  deriveWalkColliders(
                    other,
                    openIds,
                    [],
                    levels.find((level) => level.floorId === other.id)!.elevationMeters,
                    terrain,
                  ),
              ),
          ]
        : floorColliders,
      verticalRange,
    ),
  );
  const candidate = { ...pose, ...next };
  const plan = worldPointToPlan(next, building.coordinates);
  if (pose.stairId) {
    // The active flight owns traversal even when another footprint overlaps it.
    const flight = flights.find((flight) => flight?.id === pose.stairId);
    if (
      !flight ||
      (!flight.terrain &&
        pose.floorId !== flight.lowerFloorId &&
        pose.floorId !== flight.upperFloorId)
    )
      return pose;
    const halfWidth = flight.widthMeters / 2 - WALK_PLAYER_RADIUS;
    if (halfWidth < 0) return pose;
    const localElevation = pose.elevation - flight.baseElevationMeters;
    const bottom = stairEndCoordinates(next, flight.path[0], flight.entranceForward);
    const top = stairEndCoordinates(next, flight.path[flight.path.length - 1], flight.exitForward);
    const exitingBelow =
      localElevation < 0.4 && bottom.along <= 0 && Math.abs(bottom.across) <= halfWidth;
    const exitingAbove =
      localElevation > flight.riseMeters - 0.4 &&
      top.along >= 0 &&
      Math.abs(top.across) <= halfWidth;
    if (exitingBelow || exitingAbove) {
      const endpointFloorId = exitingBelow ? flight.lowerFloorId : flight.upperFloorId;
      const endElevation = flight.baseElevationMeters + (exitingBelow ? 0 : flight.riseMeters);
      let terrainLanding: BuildingWalkPoint | null = null;
      if (!endpointFloorId) {
        const height = options.terrainHeight?.(next);
        if (
          height === undefined ||
          height === null ||
          Math.abs(height - GROUND_ELEVATION_METERS - endElevation) > WALK_MAX_STEP_METERS
        )
          return pose;
        terrainLanding = resolveTerrainWalking(
          building,
          { ...candidate, elevation: endElevation },
          candidate,
          options.terrainHeight!,
        );
      }
      const destinationId = endpointFloorId ?? terrainLanding?.floorId;
      const destination = building.floors.find((f) => f.id === destinationId);
      if (
        !destinationId ||
        !destination ||
        (endpointFloorId && !pointOnFloorSupport(plan, destination))
      )
        return pose;
      if (hasUnsupportedStairAperture(flights, destinationId, plan, flight.id)) return pose;
      const destinationElevation = levels.find(
        (level) => level.floorId === destinationId,
      )!.elevationMeters;
      const items = landingItemColliders(building, destination, destinationElevation, registries);
      const allColliders =
        prepared?.colliders.get(destinationId)?.(openIds, items) ??
        deriveWalkColliders(destination, openIds, items, destinationElevation, terrain);
      const colliders = walkCollidersForVerticalRange(allColliders, verticalRange);
      const resolved = resolveCircleMovement(
        pose,
        { x: next.x - pose.x, z: next.z - pose.z },
        colliders,
      );
      if (
        !isWalkPointClear(next, colliders) ||
        Math.hypot(resolved.x - next.x, resolved.z - next.z) > 1e-8
      )
        return pose;
      const { stairId: _stairId, ...landed } = candidate;
      return {
        ...landed,
        floorId: destinationId,
        elevation: terrainLanding?.elevation ?? endElevation,
      };
    }
    const projected = projectStairPath(flight, next, localElevation);
    if (!projected || projected.distance > halfWidth + 1e-8) return pose;
    return { ...candidate, elevation: flight.baseElevationMeters + projected.elevation };
  }
  let entrance: { stairId: string; elevation: number } | undefined;
  let blockedByFootprint = false;
  for (const flight of flights) {
    if (
      !flight ||
      (!flight.terrain &&
        pose.floorId !== flight.lowerFloorId &&
        pose.floorId !== flight.upperFloorId)
    )
      continue;
    for (const fromBelow of flight.terrain
      ? [true, false]
      : [pose.floorId === flight.lowerFloorId]) {
      const endpointFloorId = fromBelow ? flight.lowerFloorId : flight.upperFloorId;
      const endpointElevation = flight.baseElevationMeters + (fromBelow ? 0 : flight.riseMeters);
      if (
        flight.terrain &&
        ((endpointFloorId && endpointFloorId !== pose.floorId) ||
          Math.abs(pose.elevation - endpointElevation) > WALK_MAX_STEP_METERS)
      )
        continue;
      if (!endpointFloorId && !options.terrainHeight) continue;
      const end = fromBelow ? flight.path[0] : flight.path[flight.path.length - 1];
      const forward = fromBelow ? flight.entranceForward : flight.exitForward;
      const previous = stairEndCoordinates(pose, end, forward),
        current = stairEndCoordinates(next, end, forward);
      const halfWidth = flight.widthMeters / 2 - WALK_PLAYER_RADIUS;
      const entering = fromBelow
        ? previous.along <= 1e-8 && current.along >= -1e-8
        : previous.along >= -1e-8 && current.along <= 1e-8;
      if (entering && halfWidth >= 0 && Math.abs(current.across) <= halfWidth) {
        const projected = projectStairPath(flight, next, fromBelow ? 0 : flight.riseMeters);
        // Stable IDs break ties independently of persisted stair array order.
        if (
          projected &&
          projected.distance <= halfWidth &&
          (!entrance || flight.id < entrance.stairId)
        ) {
          entrance = {
            stairId: flight.id,
            elevation: flight.baseElevationMeters + projected.elevation,
          };
        }
      }
      if (
        fromBelow &&
        pointInsidePolygon(plan, flight.footprint) &&
        !pointInsidePolygon(plan, flight.lowerLanding)
      )
        blockedByFootprint = true;
    }
  }
  if (entrance) return { ...candidate, ...entrance };
  if (blockedByFootprint || hasUnsupportedStairAperture(flights, floor.id, plan)) return pose;
  if (options.terrainHeight)
    return resolveTerrainWalking(
      building,
      pose,
      candidate,
      options.terrainHeight,
      options.allowUnsupported,
    );
  if (
    floor.id !== building.floors.find((floor) => !floor.belowGround)?.id &&
    !pointOnFloorSupport(plan, floor) &&
    !options.allowUnsupported
  )
    return pose;
  return candidate;
};
export const safeBuildingSpawn = (
  building: BuildingGeometry,
  floorId: string,
  start?: import("../types").PlanPoint,
  supportsTerrain?: (point: WalkPoint) => boolean,
) => {
  const floor = building.floors.find((f) => f.id === floorId);
  if (!floor || floor.footprint.length < 3) return null;
  const holes = building.stairs.flatMap((stair) => {
    const flight = stair.upperFloorId === floorId ? deriveStairFlight(building, stair) : null;
    if (!flight) return [];
    const points = flight.footprint.map((point) => planPointToWorld(point, building.coordinates));
    return [
      {
        kind: "box" as const,
        id: stair.id,
        minX: Math.min(...points.map((p) => p[0])),
        maxX: Math.max(...points.map((p) => p[0])),
        minZ: Math.min(...points.map((p) => p[1])),
        maxZ: Math.max(...points.map((p) => p[1])),
      },
    ];
  });
  const elevation = deriveFloorLevels(building.floors).find(
    (f) => f.floorId === floorId,
  )!.elevationMeters;
  const items = landingItemColliders(building, floor, elevation);
  const terrain = building.home?.apartmentFloor
    ? null
    : createTerrainSurface(building.home?.terrain, building.floors);
  const colliders = [
    ...deriveWalkColliders(floor, new Set(), [], elevation, terrain),
    ...holes,
    ...items,
  ];
  if (start) {
    const [x, z] = planPointToWorld(start, building.coordinates);
    const supported =
      pointOnFloorSupport(start, floor) ||
      (floor.id === building.floors.find((candidate) => !candidate.belowGround)?.id &&
        supportsTerrain?.({ x, z }));
    return supported && isWalkPointClear({ x, z }, colliders)
      ? { x, z, yaw: Math.PI, pitch: 0, floorId, elevation }
      : null;
  }
  const spawnRegions = [
    ...floor.rooms,
    ...(floor.outdoorPlatforms ?? []).map((platform) => ({
      id: platform.id,
      name: "Outdoor platform",
      polygon: platform.polygon,
      accent: "#c8b79b",
      devices: [],
      dashboardSlots: [],
    })),
  ];
  for (const room of spawnRegions) {
    const pose = safeSpawnPoseForRoom(room, floor, colliders, WALK_PLAYER_RADIUS);
    if (!pose || !isWalkPointClear(pose, colliders)) continue;
    const point = worldPointToPlan(pose, building.coordinates);
    if (
      building.stairs.some(
        (stair) =>
          stair.upperFloorId === floorId &&
          pointInsidePolygon(point, deriveStairFlight(building, stair)?.footprint ?? []),
      )
    )
      continue;
    return { ...pose, floorId, elevation };
  }
  return null;
};
