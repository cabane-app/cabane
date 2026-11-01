import { wallNicheCutPolygon } from "./wall-niche-cut";
import { differenceClippingGeometry, unionClippingPolygons } from "./architecture-clipping";
import { EPSILON } from "./architecture-geometry-contract";
import { uniqueSorted } from "./architecture-mesh-buckets";
import { openingCutPolygon, wallSolidFootprintPolygons } from "./wall-solid-footprints";
import { physicalFloor } from "./physical-floor";
import type { FloorSpec } from "../types";

/** Shared physical wall slices; door open/closed runtime state does not fill apertures. */
export function wallSolidBands(requestedFloor: FloorSpec) {
  const floor = physicalFloor(requestedFloor);
  const heights = uniqueSorted([
    0,
    ...floor.walls.map((wall) => wall.heightMeters ?? floor.defaultWallHeightMeters),
    ...floor.walls.flatMap((wall) =>
      (wall.niches ?? []).flatMap((niche) => [
        niche.bottomMeters,
        niche.bottomMeters + niche.heightMeters,
        ...(niche.shelfHeightsMeters ?? []).flatMap((level) => [
          niche.bottomMeters + level,
          niche.bottomMeters + level + (niche.shelfThicknessMeters ?? 0.025),
        ]),
      ]),
    ),
    ...floor.openings.flatMap((opening) => [
      opening.sillHeightMeters,
      opening.sillHeightMeters + opening.openingHeightMeters,
    ]),
  ]);
  return heights.slice(0, -1).map((bottom, index) => {
    const top = heights[index + 1];
    const middle = (bottom + top) / 2;
    const activeWalls = floor.walls.filter(
      (wall) => (wall.heightMeters ?? floor.defaultWallHeightMeters) > middle,
    );
    const solids = wallSolidFootprintPolygons(floor, activeWalls);
    let footprint = unionClippingPolygons(solids);
    const cuts = floor.openings.flatMap((opening) => {
      const openingBottom = opening.sillHeightMeters;
      const openingTop = opening.sillHeightMeters + opening.openingHeightMeters;
      const wall = activeWalls.find((candidate) => candidate.id === opening.wallId);
      return wall && middle > openingBottom - EPSILON && middle < openingTop + EPSILON
        ? [openingCutPolygon(wall, opening, floor)]
        : [];
    });
    cuts.push(
      ...activeWalls.flatMap((wall) =>
        (wall.niches ?? []).flatMap((niche) =>
          middle > niche.bottomMeters - EPSILON &&
          middle < niche.bottomMeters + niche.heightMeters + EPSILON &&
          !(niche.shelfHeightsMeters ?? []).some(
            (level) =>
              middle > niche.bottomMeters + level - EPSILON &&
              middle < niche.bottomMeters + level + (niche.shelfThicknessMeters ?? 0.025) + EPSILON,
          )
            ? [wallNicheCutPolygon(wall, niche, floor)]
            : [],
        ),
      ),
    );
    if (footprint[0] && cuts.length) footprint = differenceClippingGeometry(footprint, ...cuts);
    return { bottom, top, activeWalls, footprint };
  });
}
