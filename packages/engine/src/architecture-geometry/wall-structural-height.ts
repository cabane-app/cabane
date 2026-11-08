import type { FloorSpec, WallSpec } from "../types";
import { wallCeilingProfile } from "./wall-gable-geometry";
/** Preserve authored low barriers while continuing full-height facade finishes across slabs. */
export const wallStructuralHeight = (wall: WallSpec, floor: FloorSpec) => {
  const height = wall.heightMeters ?? floor.defaultWallHeightMeters;
  if (
    wall.classification !== "exterior" ||
    height < floor.defaultCeilingHeightMeters - 0.001 ||
    height >= floor.floorToFloorHeightMeters
  )
    return height;
  // A rendered eave can be below the next storey, for example over a side wing.
  let top = floor.floorToFloorHeightMeters;
  if (floor.ceilings?.some((ceiling) => ceiling.kind === "sloped")) {
    for (const run of wallCeilingProfile(wall, floor))
      for (const [, ceilingHeight] of run) top = Math.min(top, ceilingHeight);
  }
  return Math.max(height, top);
};
