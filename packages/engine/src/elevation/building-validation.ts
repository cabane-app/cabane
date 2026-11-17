import { WALK_MAX_STEP_METERS } from "../navigation/walk-navigation-contract";
import { deriveFloorLevels } from "../building/floor-levels";
import { platformPolygonsOverlap } from "../outdoor-platforms/platform-geometry";
import type { BuildingGeometry } from "../stairs/types";
import type { FloorSpec, ManifestIssue } from "../types";
import { ceilingHeightAt } from "./ceilings";
import { elevationAreas, localSurfaceAt } from "./surfaces";

/** Local changes cannot consume the occupied space of a neighbouring storey. */
export function validateElevationStoreys(building: BuildingGeometry): ManifestIssue[] {
  const levels = deriveFloorLevels(building.floors);
  return building.floors.flatMap((floor, index) => {
    const issues: ManifestIssue[] = elevationOpeningIssues(floor, index);
    for (const area of elevationAreas(floor)) {
      const bottom = levels[index].elevationMeters + area.elevation.offsetMeters;
      const top = area.roomId
        ? levels[index].elevationMeters +
          Math.max(...area.polygon.map((point) => ceilingHeightAt(floor, area.roomId!, point)))
        : bottom;
      for (let otherIndex = 0; otherIndex < building.floors.length; otherIndex++) {
        if (otherIndex === index) continue;
        const other = building.floors[otherIndex];
        const otherBase = levels[otherIndex].elevationMeters;
        const conflicts = other.rooms.some((room) => {
          if (!platformPolygonsOverlap(area.polygon, room.polygon)) return false;
          if (otherIndex > index) return top > otherBase + 1e-6;
          const ceiling = Math.max(
            ...room.polygon.map((point) => ceilingHeightAt(other, room.id, point)),
          );
          return bottom < otherBase + ceiling - 1e-6;
        });
        if (conflicts)
          issues.push({
            code: "elevation.storey-conflict",
            path: `floors[${index}].elevation.${area.id}`,
            severity: "fatal",
            message: `This area intersects occupied space on “${other.name}”. Adjust its floor or ceiling height.`,
          });
      }
    }
    return issues;
  });
}

/** Preserve authored openings, but explain thresholds that no longer meet a floor. */
function elevationOpeningIssues(floor: FloorSpec, index: number): ManifestIssue[] {
  if (!elevationAreas(floor).length) return [];
  return floor.openings.flatMap((opening) => {
    if (opening.kind === "window") return [];
    const wall = floor.walls.find((wall) => wall.id === opening.wallId);
    if (!wall) return [];
    const dx = wall.to[0] - wall.from[0],
      dz = wall.to[1] - wall.from[1];
    const length = Math.hypot(dx, dz);
    if (!length) return [];
    const along = opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2;
    const across = (wall.thicknessMeters / 2 + 0.02) / floor.coordinates.metersPerPlanUnit;
    const inaccessible = [-1, 1].some((side) => {
      const at = [
        wall.from[0] + (dx / length) * along - (dz / length) * across * side,
        wall.from[1] + (dz / length) * along + (dx / length) * across * side,
      ] as const;
      const support = localSurfaceAt(floor, at);
      return (
        support.id !== floor.id &&
        Math.abs(support.elevation - opening.sillHeightMeters) > WALK_MAX_STEP_METERS
      );
    });
    return inaccessible
      ? [
          {
            code: "elevation.opening-threshold",
            path: `floors[${index}].openings.${opening.id}`,
            severity: "warning" as const,
            message:
              "This opening no longer meets the local floor. Add steps or adjust the area; the opening keeps its authored height.",
          },
        ]
      : [];
  });
}
