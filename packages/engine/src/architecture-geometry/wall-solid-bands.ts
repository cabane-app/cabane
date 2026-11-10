import { elevationAreas } from "../elevation/surfaces";
import { lowerWallFootprint } from "../elevation/wall-support";
import { openingCutTop } from "../geometry";
import { wallNicheCutPolygon } from "./wall-niche-cut";
import { differenceClippingGeometry, unionClippingPolygons } from "./architecture-clipping";
import { EPSILON } from "./architecture-geometry-contract";
import { uniqueSorted } from "./architecture-mesh-buckets";
import { openingCutPolygon, wallSolidFootprintPolygons } from "./wall-solid-footprints";
import { physicalFloor } from "./physical-floor";
import type { WallCornerBand } from "./wall-gable-corners";
import type { FloorSpec } from "../types";

/** Shared physical wall slices; door open/closed runtime state does not fill apertures. */
export function wallSolidBands(
  requestedFloor: FloorSpec,
  cornerBands: readonly WallCornerBand[] = [],
) {
  const floor = physicalFloor(requestedFloor);
  const wallsById = new Map(floor.walls.map((wall) => [wall.id, wall]));
  const openings = floor.openings.flatMap((opening) => {
    const wall = wallsById.get(opening.wallId);
    if (!wall) return [];
    const top = openingCutTop(opening, wall.heightMeters ?? floor.defaultWallHeightMeters);
    return [{ opening, wall, top }];
  });
  const heights = uniqueSorted([
    0,
    ...elevationAreas(floor)
      .filter((area) => area.roomId && area.elevation.offsetMeters < 0)
      .map((area) => area.elevation.offsetMeters),
    ...floor.walls.map((wall) => wall.heightMeters ?? floor.defaultWallHeightMeters),
    ...cornerBands.map(({ top }) => top),
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
    ...openings.flatMap(({ opening, top }) => [opening.sillHeightMeters, top]),
  ]);
  return heights.slice(0, -1).map((bottom, index) => {
    const top = heights[index + 1];
    const middle = (bottom + top) / 2;
    const activeWalls = floor.walls.filter(
      (wall) => (wall.heightMeters ?? floor.defaultWallHeightMeters) > middle,
    );
    const solids = wallSolidFootprintPolygons(floor, activeWalls);
    const corners = cornerBands.filter((band) => middle > band.bottom && middle < band.top);
    solids.push(...corners.map(({ footprint }) => footprint));
    let footprint = unionClippingPolygons(solids);
    if (middle < 0) footprint = lowerWallFootprint(floor, footprint, middle);
    const cuts = openings.flatMap(({ opening, wall, top }) => {
      return activeWalls.includes(wall) &&
        middle > opening.sillHeightMeters - EPSILON &&
        middle < top + EPSILON
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
    const owners = corners.length
      ? [...new Set([...activeWalls, ...corners.flatMap(({ walls }) => walls)])]
      : activeWalls;
    return { bottom, top, activeWalls: owners, footprint };
  });
}
