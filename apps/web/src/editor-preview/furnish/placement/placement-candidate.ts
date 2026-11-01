import {
  physicalFloor,
  pointOnFloorSupport,
  pointInsidePolygon,
  pointStrictlyOutsideFloorFootprint,
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type PlanPoint,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { insetWallPlacementIntoRoom } from "./wall-room-inset";

export interface PlacementInput {
  at: PlanPoint;
  kind?: ItemPlacement["kind"];
  wallId?: string;
  face?: "left" | "right";
  offset?: number;
  elevation?: number;
  drop?: number;
  raw?: boolean;
}
export interface PlacementCandidate {
  placement: ItemPlacement | null;
  error: string | null;
}
const invalid = (error: string): PlacementCandidate => ({ placement: null, error });

export function placementCandidate(
  entry: { definition: SceneModelEditorDescriptor },
  sourceFloor: FloorSpec,
  input: PlacementInput,
): PlacementCandidate {
  const floor = physicalFloor(sourceFloor);
  const definition = entry.definition;
  const elevated = ((floor as FloorSpec & { elevationMeters?: number }).elevationMeters ?? 0) > 0;
  const outdoor = definition.placementEnvironment === "outdoor";
  const scale = floor.coordinates.metersPerPlanUnit;
  if (!input.at.every(Number.isFinite) || !(scale > 0)) return invalid("Enter a valid position.");
  const snap = (value: number, axis: number) =>
    input.raw
      ? value
      : floor.coordinates.origin[axis] +
        Math.round((value - floor.coordinates.origin[axis]) * scale * 10) / (10 * scale);
  const at: PlanPoint = [snap(input.at[0], 0), snap(input.at[1], 1)];
  const walls = floor.walls
    .flatMap((wall) => {
      const dx = wall.to[0] - wall.from[0],
        dz = wall.to[1] - wall.from[1];
      const length = Math.hypot(dx, dz);
      if (length <= 0) return [];
      const offset = ((at[0] - wall.from[0]) * dx + (at[1] - wall.from[1]) * dz) / length;
      const clamped = Math.max(0, Math.min(length, offset));
      const point: PlanPoint = [
        wall.from[0] + (dx * clamped) / length,
        wall.from[1] + (dz * clamped) / length,
      ];
      const side = (at[0] - point[0]) * -dz + (at[1] - point[1]) * dx;
      return [
        {
          wall,
          length,
          offset: clamped,
          distance: Math.hypot(at[0] - point[0], at[1] - point[1]) * scale,
          face: side < 0 ? ("left" as const) : ("right" as const),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
  const near = input.wallId
    ? walls.find((candidate) => candidate.wall.id === input.wallId)
    : walls[0];
  if (outdoor && input.kind && input.kind !== "absolute") {
    return invalid("Outdoor items use ground placement.");
  }
  const kind = outdoor
    ? "absolute"
    : (input.kind ??
      (input.wallId || (!input.raw && near && near.distance <= 0.55)
        ? "wall"
        : definition.preferredPlacement));
  let placement: ItemPlacement;
  if (kind === "wall") {
    if (!near || (!input.wallId && near.distance > 0.55))
      return invalid("Choose a wall to place this item.");
    const halfWidth =
      Math.max(Math.abs(definition.bounds.min[0]), Math.abs(definition.bounds.max[0])) / scale;
    const offset =
      input.offset ?? Math.max(halfWidth, Math.min(near.length - halfWidth, near.offset));
    if (!Number.isFinite(offset) || offset < halfWidth || offset + halfWidth > near.length)
      return invalid("This item needs more space along the wall.");
    const height = near.wall.heightMeters ?? floor.defaultWallHeightMeters;
    const lowest = Math.max(0, -definition.bounds.min[1]);
    const highest = height - Math.max(0, definition.bounds.max[1]);
    const elevation =
      input.elevation ??
      Math.max(lowest, Math.min(highest, definition.defaultSize[1] > 1.5 ? lowest : 1.25));
    if (!Number.isFinite(elevation) || elevation < lowest || elevation > highest)
      return invalid("The item must fit between the floor and wall top.");
    placement = {
      kind,
      wallId: near.wall.id,
      face: input.face ?? near.face,
      offsetFromWallStartPlanUnits: offset,
      elevationMeters: elevation,
      depthOffsetMeters: Math.max(0, -definition.bounds.min[2]) + 0.003,
      rotationOffsetRadians: 0,
    };
  } else {
    const rooms = floor.rooms.filter((room) => pointInsidePolygon(at, room.polygon));
    if (outdoor) {
      if (
        !floor.outdoorPlatforms?.some((p) => pointInsidePolygon(at, p.polygon)) &&
        !pointStrictlyOutsideFloorFootprint(at, floor)
      ) {
        return invalid("Choose a position outside the building.");
      }
    } else if (kind === "ceiling" && rooms.length !== 1)
      return invalid("Choose a position inside one room.");
    if (kind === "ceiling") {
      const ceiling = floor.ceilings?.find((item) => item.roomIds.includes(rooms[0].id));
      const height =
        ceiling?.kind === "flat" ? ceiling.heightMeters : floor.defaultCeilingHeightMeters;
      const drop = input.drop ?? Math.max(0, definition.bounds.max[1]) + 0.003;
      if (
        !Number.isFinite(drop) ||
        drop < Math.max(0, definition.bounds.max[1]) ||
        drop > height ||
        height - drop + definition.bounds.min[1] < 0
      )
        return invalid("The item must fit below the ceiling and above the floor.");
      placement = { kind, roomId: rooms[0].id, at, dropMeters: drop, rotationYRadians: 0 };
    } else {
      if (elevated && !pointOnFloorSupport(at, floor))
        return invalid("Choose a room floor or outdoor platform on this level.");
      const elevation = input.elevation ?? Math.max(0, -definition.bounds.min[1]) + 0.001;
      if (!Number.isFinite(elevation) || elevation < Math.max(0, -definition.bounds.min[1]))
        return invalid("The item must stay above the floor.");
      placement = { kind, at, elevationMeters: elevation, rotationYRadians: 0 };
    }
  }
  const roomCount = (candidate: ItemPlacement) => {
    const transform = resolveItemTransform(candidate, floor);
    const resolvedAt: PlanPoint = [
      transform.position[0] / scale + floor.coordinates.origin[0],
      transform.position[2] / scale + floor.coordinates.origin[1],
    ];
    return floor.rooms.filter((room) => pointInsidePolygon(resolvedAt, room.polygon)).length;
  };
  if (placement.kind === "wall") placement = insetWallPlacementIntoRoom(placement, floor);
  if (outdoor) {
    if (
      placement.kind !== "absolute" ||
      (!floor.outdoorPlatforms?.some((p) => pointInsidePolygon(placement.at, p.polygon)) &&
        !pointStrictlyOutsideFloorFootprint(placement.at, floor))
    ) {
      return invalid("Choose a position outside the building.");
    }
  } else if (roomCount(placement) > 1)
    return invalid("Choose a position belonging to at most one room.");
  return { placement, error: null };
}
