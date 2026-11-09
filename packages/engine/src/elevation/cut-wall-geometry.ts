import { BufferGeometry } from "three";
import { worldPointToPlan } from "../geometry";
import { pointOnPolygonBoundary } from "../validation/geometry";
import type { FloorCoordinates, Polygon } from "../types";

/** Elevation transitions own these faces; extrusion hole walls would overlap them. */
export function removeElevationCutWalls(
  source: BufferGeometry,
  coordinates: FloorCoordinates,
  cuts: readonly Polygon[],
): BufferGeometry {
  if (!cuts.length) return source;
  const geometry = source.index ? source.toNonIndexed() : source;
  const positions = geometry.getAttribute("position");
  const keep: number[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    const vertical =
      Math.max(positions.getZ(i), positions.getZ(i + 1), positions.getZ(i + 2)) -
        Math.min(positions.getZ(i), positions.getZ(i + 1), positions.getZ(i + 2)) >
      1e-8;
    const point = worldPointToPlan(
      {
        x: (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3,
        z: -(positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3,
      },
      coordinates,
    );
    if (!vertical || !cuts.some((polygon) => pointOnPolygonBoundary(point, polygon)))
      keep.push(i, i + 1, i + 2);
  }
  const groups = geometry.groups.map((group) => ({ ...group }));
  geometry.setIndex(keep);
  geometry.clearGroups();
  for (const group of groups) {
    const start = keep.findIndex((index) => index >= group.start);
    const count = keep.filter(
      (index) => index >= group.start && index < group.start + group.count,
    ).length;
    if (count > 0) geometry.addGroup(start, count, group.materialIndex);
  }
  if (geometry !== source) source.dispose();
  return geometry;
}
