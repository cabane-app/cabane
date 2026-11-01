import type { FloorSpec, WallJunctionSpec, WallSpec } from "../types";

export const isVirtualWall = (wall: Pick<WallSpec, "virtual">): boolean => wall.virtual === true;

const cache = new WeakMap<FloorSpec, FloorSpec>();

/**
 * The floor as built: virtual room dividers removed so geometry, collision and
 * shadows see open floor. Junctions keep only physical walls and are dropped
 * when fewer than two remain. Rooms and ceilings are untouched. Returns the
 * same object when the floor has no virtual walls.
 */
export const physicalFloor = (floor: FloorSpec): FloorSpec => {
  if (!floor.walls.some(isVirtualWall)) return floor;
  const cached = cache.get(floor);
  if (cached) return cached;
  const virtualIds = new Set(floor.walls.filter(isVirtualWall).map((wall) => wall.id));
  const wallJunctions = floor.wallJunctions.flatMap((junction): WallJunctionSpec[] => {
    const wallIds = junction.wallIds.filter((id) => !virtualIds.has(id));
    return wallIds.length >= 2
      ? [{ ...junction, wallIds: wallIds as unknown as WallJunctionSpec["wallIds"] }]
      : [];
  });
  const result = {
    ...floor,
    walls: floor.walls.filter((wall) => !isVirtualWall(wall)),
    wallJunctions,
  };
  cache.set(floor, result);
  return result;
};
