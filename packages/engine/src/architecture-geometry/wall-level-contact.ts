import { wallStructuralHeight } from "./wall-structural-height";
import { openingCutTop } from "../geometry";
import type { FloorSpec } from "../types";
import { differenceClippingGeometry, unionClippingPolygons } from "./architecture-clipping";
import { openingCutPolygon, wallSolidFootprintPolygons } from "./wall-solid-footprints";

/** Wall cross-section just inside a level boundary, excluding doors and passages. */
export function wallLevelContact(floor: FloorSpec | undefined, edge: "top" | "bottom") {
  if (!floor) return [];
  const height = edge === "top" ? floor.floorToFloorHeightMeters - 1e-6 : 1e-6;
  const walls = floor.walls.filter(
    (wall) =>
      (edge === "top" && wall.classification === "exterior"
        ? wallStructuralHeight(wall, floor)
        : (wall.heightMeters ?? floor.defaultWallHeightMeters)) > height,
  );
  const solids = unionClippingPolygons(wallSolidFootprintPolygons(floor, walls));
  const openings = floor.openings.flatMap((opening) => {
    if (opening.sillHeightMeters > height || openingCutTop(opening, height) < height) return [];
    const wall = walls.find((wall) => wall.id === opening.wallId);
    return wall ? [openingCutPolygon(wall, opening, floor)] : [];
  });
  return openings.length
    ? differenceClippingGeometry(solids, unionClippingPolygons(openings))
    : solids;
}
