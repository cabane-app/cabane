import type { Polygon as ClippingPolygon } from "polygon-clipping";
import type { FloorSpec, PlanPoint, WallSpec } from "../types";
import { EPSILON } from "./architecture-geometry-contract";
import type { WallGableShapes } from "./wall-gable-geometry";
import { junctionCornerMiterPolygon } from "./wall-solid-footprints";
import { wallFrame } from "./wall-coordinate-frame";

export interface WallCornerBand {
  bottom: number;
  top: number;
  footprint: ClippingPolygon;
  walls: readonly WallSpec[];
}

const atPoint = (a: PlanPoint, b: PlanPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPSILON;

function gableEndpointHeight(shapes: WallGableShapes, station: number) {
  for (const run of shapes.profile) {
    const point = run.find(([distance]) => Math.abs(distance - station) <= EPSILON);
    if (point) return point[1];
  }
  return shapes.wallHeightMeters;
}

/** Keep the ordinary corner miter where a gable continues above its horizontal bands. */
export function wallGableCornerBands(
  floor: FloorSpec,
  gables: ReadonlyMap<string, WallGableShapes>,
): WallCornerBand[] {
  if (!gables.size) return [];
  const byId = new Map(floor.walls.map((wall) => [wall.id, wall]));
  const bandHeight = (wall: WallSpec) => wall.heightMeters ?? floor.defaultWallHeightMeters;
  return floor.wallJunctions.flatMap((junction) => {
    if (junction.wallIds.length !== 2 || !junction.wallIds.some((id) => gables.has(id))) return [];
    const walls = junction.wallIds.map((id) => byId.get(id)).filter((wall) => wall !== undefined);
    if (
      walls.length !== 2 ||
      walls.some((wall) => !atPoint(wall.from, junction.at) && !atPoint(wall.to, junction.at))
    )
      return [];
    const bottom = Math.min(...walls.map(bandHeight));
    const top = Math.min(
      ...walls.map((wall) => {
        const shapes = gables.get(wall.id);
        if (!shapes) return bandHeight(wall);
        const station = atPoint(wall.from, junction.at) ? 0 : wallFrame(wall, floor).length;
        return gableEndpointHeight(shapes, station);
      }),
    );
    if (top - bottom <= EPSILON) return [];
    const footprint = junctionCornerMiterPolygon(junction, walls, floor);
    return footprint ? [{ bottom, top, footprint, walls }] : [];
  });
}
