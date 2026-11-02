import {
  physicalFloor,
  planPointToWorld,
  pointInsidePolygon,
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type PlanPoint,
  type SceneItemSpec,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { insetWallPlacementIntoRoom } from "./wall-room-inset";

type FloorWall = FloorSpec["walls"][number];
type WallPlacement = Extract<ItemPlacement, { kind: "wall" }>;
type WorldPoint = readonly [x: number, z: number];

interface WallDragCandidate {
  wall: FloorWall;
  lengthPlanUnits: number;
  projected: PlanPoint;
  offsetPlanUnits: number;
  distanceMeters: number;
  tangent: WorldPoint;
  rightNormal: WorldPoint;
}

interface WallArm {
  direction: WorldPoint;
  lengthMeters: number;
}

const EPSILON = 1e-7;

const dot = (left: WorldPoint, right: WorldPoint) => left[0] * right[0] + left[1] * right[1];

const samePlanPoint = (left: PlanPoint, right: PlanPoint) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= EPSILON;

const wallDragCandidate = (
  rawAt: PlanPoint,
  wall: FloorWall,
  metersPerPlanUnit: number,
): WallDragCandidate | null => {
  const dx = wall.to[0] - wall.from[0];
  const dz = wall.to[1] - wall.from[1];
  const squared = dx * dx + dz * dz;
  if (squared <= EPSILON * EPSILON) return null;
  const lengthPlanUnits = Math.sqrt(squared);
  const offsetPlanUnits = Math.max(
    0,
    Math.min(
      lengthPlanUnits,
      ((rawAt[0] - wall.from[0]) * dx + (rawAt[1] - wall.from[1]) * dz) / lengthPlanUnits,
    ),
  );
  const progress = offsetPlanUnits / lengthPlanUnits;
  const projected: PlanPoint = [wall.from[0] + dx * progress, wall.from[1] + dz * progress];
  const tangent: WorldPoint = [dx / lengthPlanUnits, dz / lengthPlanUnits];
  return {
    wall,
    lengthPlanUnits,
    projected,
    offsetPlanUnits,
    distanceMeters:
      Math.hypot(rawAt[0] - projected[0], rawAt[1] - projected[1]) * metersPerPlanUnit,
    tangent,
    rightNormal: [-tangent[1], tangent[0]],
  };
};

const faceForPoint = (rawAt: PlanPoint, candidate: WallDragCandidate) => {
  const fromWall: WorldPoint = [
    rawAt[0] - candidate.projected[0],
    rawAt[1] - candidate.projected[1],
  ];
  return dot(fromWall, candidate.rightNormal) < 0 ? ("left" as const) : ("right" as const);
};

const faceNormal = (candidate: WallDragCandidate, face: "left" | "right"): WorldPoint =>
  face === "right" ? candidate.rightNormal : [-candidate.rightNormal[0], -candidate.rightNormal[1]];

const endpointArm = (
  candidate: WallDragCandidate,
  corner: PlanPoint,
  metersPerPlanUnit: number,
): WallArm | null => {
  const other = samePlanPoint(candidate.wall.from, corner)
    ? candidate.wall.to
    : samePlanPoint(candidate.wall.to, corner)
      ? candidate.wall.from
      : null;
  if (!other) return null;
  const dx = other[0] - corner[0];
  const dz = other[1] - corner[1];
  const lengthPlanUnits = Math.hypot(dx, dz);
  if (lengthPlanUnits <= EPSILON) return null;
  return {
    direction: [dx / lengthPlanUnits, dz / lengthPlanUnits],
    lengthMeters: lengthPlanUnits * metersPerPlanUnit,
  };
};

const scaledBounds = (item: SceneItemSpec, definition: SceneModelEditorDescriptor) => ({
  minX: (definition.bounds.min[0] * item.size[0]) / definition.defaultSize[0],
  maxX: (definition.bounds.max[0] * item.size[0]) / definition.defaultSize[0],
  minZ: (definition.bounds.min[2] * item.size[2]) / definition.defaultSize[2],
  maxZ: (definition.bounds.max[2] * item.size[2]) / definition.defaultSize[2],
});

const footprintCorners = (
  placement: WallPlacement,
  item: SceneItemSpec,
  definition: SceneModelEditorDescriptor,
  floor: FloorSpec,
): readonly WorldPoint[] => {
  const transform = resolveItemTransform(placement, floor);
  const bounds = scaledBounds(item, definition);
  const cosine = Math.cos(transform.rotationYRadians);
  const sine = Math.sin(transform.rotationYRadians);
  return [bounds.minX, bounds.maxX].flatMap((x) =>
    [bounds.minZ, bounds.maxZ].map((z): WorldPoint => [
      transform.position[0] + x * cosine + z * sine,
      transform.position[2] - x * sine + z * cosine,
    ]),
  );
};

const wallPlacement = (
  candidate: WallDragCandidate,
  rawAt: PlanPoint,
  item: SceneItemSpec,
  definition: SceneModelEditorDescriptor,
  floor: FloorSpec,
): WallPlacement => {
  const face = faceForPoint(rawAt, candidate);
  const sameSupport =
    item.placement.kind === "wall" &&
    item.placement.wallId === candidate.wall.id &&
    item.placement.face === face;
  const bounds = scaledBounds(item, definition);
  return insetWallPlacementIntoRoom(
    {
      kind: "wall",
      wallId: candidate.wall.id,
      face,
      offsetFromWallStartPlanUnits: Number(candidate.offsetPlanUnits.toFixed(4)),
      elevationMeters: resolveItemTransform(item.placement, floor).position[1],
      depthOffsetMeters: sameSupport
        ? item.placement.kind === "wall"
          ? item.placement.depthOffsetMeters
          : Math.max(0, -bounds.minZ)
        : Math.max(definition.windowFit?.depthOffsetMeters ?? 0, -bounds.minZ),
      rotationOffsetRadians:
        sameSupport && item.placement.kind === "wall" ? item.placement.rotationOffsetRadians : 0,
    },
    floor,
  );
};

const nearestEdgeFitsWallArm = (
  points: readonly WorldPoint[],
  facePoint: WorldPoint,
  faceNormal: WorldPoint,
  corner: WorldPoint,
  arm: WallArm,
) => {
  const distances = points.map((point) =>
    dot([point[0] - facePoint[0], point[1] - facePoint[1]], faceNormal),
  );
  const nearest = Math.min(...distances);
  const contacts = points.filter((_point, index) => distances[index] <= nearest + 1e-4);
  const offsets = contacts.map((point) =>
    dot([point[0] - corner[0], point[1] - corner[1]], arm.direction),
  );
  return Math.min(...offsets) >= -EPSILON && Math.max(...offsets) <= arm.lengthMeters + EPSILON;
};

const resolvedRoomCount = (placement: WallPlacement, floor: FloorSpec) => {
  const { position } = resolveItemTransform(placement, floor);
  const scale = floor.coordinates.metersPerPlanUnit;
  const at: PlanPoint = [
    position[0] / scale + floor.coordinates.origin[0],
    position[2] / scale + floor.coordinates.origin[1],
  ];
  return floor.rooms.filter((room) => pointInsidePolygon(at, room.polygon)).length;
};

interface CornerPlacementCandidate {
  placement: WallPlacement;
  gapMeters: number;
  adjustmentMeters: number;
  junctionId: string;
}

const cornerPlacement = ({
  rawAt,
  item,
  definition,
  floor,
  primary,
  candidatesByWallId,
  cornerSnapDistanceMeters,
}: {
  rawAt: PlanPoint;
  item: SceneItemSpec;
  definition: SceneModelEditorDescriptor;
  floor: FloorSpec;
  primary: WallDragCandidate;
  candidatesByWallId: ReadonlyMap<string, WallDragCandidate>;
  cornerSnapDistanceMeters: number;
}): CornerPlacementCandidate | null => {
  const scale = floor.coordinates.metersPerPlanUnit;
  const base = wallPlacement(primary, rawAt, item, definition, floor);
  const baseTransform = resolveItemTransform(base, floor);
  const basePoints = footprintCorners(base, item, definition, floor);
  const matches = floor.wallJunctions
    .flatMap((junction): CornerPlacementCandidate[] => {
      if (junction.wallIds.length !== 2 || !junction.wallIds.includes(primary.wall.id)) return [];
      const secondaryId = junction.wallIds.find((wallId) => wallId !== primary.wall.id);
      const secondary = secondaryId ? candidatesByWallId.get(secondaryId) : undefined;
      if (!secondary) return [];
      const primaryArm = endpointArm(primary, junction.at, scale);
      const secondaryArm = endpointArm(secondary, junction.at, scale);
      if (!primaryArm || !secondaryArm) return [];
      const cross =
        primaryArm.direction[0] * secondaryArm.direction[1] -
        primaryArm.direction[1] * secondaryArm.direction[0];
      if (Math.abs(cross) <= 1e-4) return [];

      const corner = planPointToWorld(junction.at, floor.coordinates);
      const fromSecondary: WorldPoint = [
        baseTransform.position[0] - corner[0],
        baseTransform.position[2] - corner[1],
      ];
      const secondaryFace = dot(fromSecondary, secondary.rightNormal) < 0 ? "left" : "right";
      const secondaryNormal = faceNormal(secondary, secondaryFace);
      const secondaryFacePoint: WorldPoint = [
        corner[0] + (secondaryNormal[0] * secondary.wall.thicknessMeters) / 2,
        corner[1] + (secondaryNormal[1] * secondary.wall.thicknessMeters) / 2,
      ];
      const distances = basePoints.map((point) =>
        dot([point[0] - secondaryFacePoint[0], point[1] - secondaryFacePoint[1]], secondaryNormal),
      );
      const minimum = Math.min(...distances);
      const maximum = Math.max(...distances);
      const gapMeters = minimum > 0 ? minimum : maximum < 0 ? -maximum : 0;
      if (gapMeters > cornerSnapDistanceMeters + EPSILON) return [];

      const denominator = dot(primary.tangent, secondaryNormal);
      if (Math.abs(denominator) <= EPSILON) return [];
      const adjustmentMeters = -minimum / denominator;
      const offsetFromWallStartPlanUnits =
        base.offsetFromWallStartPlanUnits + adjustmentMeters / scale;
      if (
        offsetFromWallStartPlanUnits < -EPSILON ||
        offsetFromWallStartPlanUnits > primary.lengthPlanUnits + EPSILON
      )
        return [];
      const placement: WallPlacement = {
        ...base,
        offsetFromWallStartPlanUnits: Number(offsetFromWallStartPlanUnits.toFixed(4)),
      };
      const points = footprintCorners(placement, item, definition, floor);
      const finalDistances = points.map((point) =>
        dot([point[0] - secondaryFacePoint[0], point[1] - secondaryFacePoint[1]], secondaryNormal),
      );
      const primaryNormal = faceNormal(primary, placement.face);
      const primaryFacePoint: WorldPoint = [
        corner[0] + (primaryNormal[0] * primary.wall.thicknessMeters) / 2,
        corner[1] + (primaryNormal[1] * primary.wall.thicknessMeters) / 2,
      ];
      if (
        Math.min(...finalDistances) < -1e-4 ||
        !nearestEdgeFitsWallArm(points, primaryFacePoint, primaryNormal, corner, primaryArm) ||
        !nearestEdgeFitsWallArm(
          points,
          secondaryFacePoint,
          secondaryNormal,
          corner,
          secondaryArm,
        ) ||
        resolvedRoomCount(placement, floor) !== 1
      )
        return [];
      return [
        {
          placement,
          gapMeters,
          adjustmentMeters: Math.abs(adjustmentMeters),
          junctionId: junction.id,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.gapMeters - right.gapMeters ||
        left.adjustmentMeters - right.adjustmentMeters ||
        left.junctionId.localeCompare(right.junctionId),
    );
  return matches[0] ?? null;
};

export const placementNearWallsForWorldDrag = ({
  rawAt,
  item,
  definition,
  floor: sourceFloor,
  wallSnapDistanceMeters = 0.55,
  cornerSnapDistanceMeters = 0.2,
}: {
  rawAt: PlanPoint;
  item: SceneItemSpec;
  definition: SceneModelEditorDescriptor;
  floor: FloorSpec;
  wallSnapDistanceMeters?: number;
  cornerSnapDistanceMeters?: number;
}): WallPlacement | null => {
  const floor = physicalFloor(sourceFloor);
  const candidates = floor.walls
    .flatMap((wall) => {
      const candidate = wallDragCandidate(rawAt, wall, floor.coordinates.metersPerPlanUnit);
      return candidate ? [candidate] : [];
    })
    .sort(
      (left, right) =>
        left.distanceMeters - right.distanceMeters || left.wall.id.localeCompare(right.wall.id),
    );
  const nearest = candidates[0];
  if (!nearest || nearest.distanceMeters > wallSnapDistanceMeters) return null;

  const currentWallId = item.placement.kind === "wall" ? item.placement.wallId : null;
  const current = currentWallId
    ? candidates.find(
        (candidate) =>
          candidate.wall.id === currentWallId && candidate.distanceMeters <= wallSnapDistanceMeters,
      )
    : undefined;
  const primaries = [current, nearest].filter(
    (candidate, index, list): candidate is WallDragCandidate =>
      candidate !== undefined &&
      list.findIndex((entry) => entry?.wall.id === candidate.wall.id) === index,
  );
  const candidatesByWallId = new Map(candidates.map((candidate) => [candidate.wall.id, candidate]));
  for (const primary of primaries) {
    const corner = cornerPlacement({
      rawAt,
      item,
      definition,
      floor,
      primary,
      candidatesByWallId,
      cornerSnapDistanceMeters,
    });
    if (corner) return corner.placement;
  }
  return wallPlacement(nearest, rawAt, item, definition, floor);
};
