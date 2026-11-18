import type { WalkParcel } from "./walk-parcel";
import {
  planPointToWorld,
  pointInsidePolygon,
  polygonCentroid,
  worldPointToPlan,
} from "../geometry";

import type { FloorSpec, PlanPoint, RoomSpec } from "../types";
import { isWalkPointClear } from "./walk-colliders";
import { WALK_PLAYER_RADIUS, WalkCollider, WalkPoint, WalkPose } from "./walk-navigation-contract";

export const safeSpawnPoseForRoom = (
  room: RoomSpec,
  floor: FloorSpec,
  colliders: readonly WalkCollider[],
  radius = WALK_PLAYER_RADIUS,
  parcel?: WalkParcel,
): WalkPose | null => {
  const centroid = polygonCentroid(room.polygon);
  const [centroidX, centroidZ] = planPointToWorld(centroid, floor.coordinates);
  const centroidCandidate = { x: centroidX, z: centroidZ };
  if (
    pointInsidePolygon(centroid, room.polygon) &&
    (!parcel || parcel.contains(centroidCandidate)) &&
    isWalkPointClear(centroidCandidate, colliders, radius)
  ) {
    return { ...centroidCandidate, yaw: Math.PI, pitch: 0 };
  }

  const worldPolygon = room.polygon.map((point) => planPointToWorld(point, floor.coordinates));
  const xs = worldPolygon.map(([x]) => x);
  const zs = worldPolygon.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const maximumSamplesPerAxis = 160;
  const targetSpacing = Math.max(0.04, radius / 2);
  const columns = Math.min(maximumSamplesPerAxis, Math.max(1, Math.ceil(width / targetSpacing)));
  const rows = Math.min(maximumSamplesPerAxis, Math.max(1, Math.ceil(depth / targetSpacing)));

  let best: WalkPoint | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let row = 0; row < rows; row += 1) {
    const z = minZ + ((row + 0.5) / rows) * depth;
    for (let column = 0; column < columns; column += 1) {
      const x = minX + ((column + 0.5) / columns) * width;
      const candidate = { x, z };
      const planCandidate = worldPointToPlan(candidate, floor.coordinates);
      if (
        !pointInsidePolygon(planCandidate, room.polygon) ||
        (parcel && !parcel.contains(candidate)) ||
        !isWalkPointClear(candidate, colliders, radius)
      )
        continue;
      const distanceSquared = (x - centroidX) * (x - centroidX) + (z - centroidZ) * (z - centroidZ);
      if (
        distanceSquared < bestDistanceSquared - 1e-9 ||
        (Math.abs(distanceSquared - bestDistanceSquared) <= 1e-9 &&
          (best === null || x < best.x || (x === best.x && z < best.z)))
      ) {
        best = candidate;
        bestDistanceSquared = distanceSquared;
      }
    }
  }
  return best === null ? null : { ...best, yaw: Math.PI, pitch: 0 };
};

export const spawnPoseForRoom = (room: RoomSpec | undefined, floor: FloorSpec): WalkPose => {
  const polygon =
    room?.polygon ??
    floor.rooms.find((candidate) => !candidate.isSolid)?.polygon ??
    floor.footprint;
  const average = polygon.reduce(
    (total, point) => [total[0] + point[0], total[1] + point[1]] as PlanPoint,
    [0, 0] as PlanPoint,
  );
  const center: PlanPoint = [average[0] / polygon.length, average[1] / polygon.length];
  const [x, z] = planPointToWorld(center, floor.coordinates);
  return { x, z, yaw: Math.PI, pitch: 0 };
};
