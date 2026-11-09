import { BufferGeometry } from "three";
import { planPointToWorld } from "../geometry";
import { CLIPPING_GRID_METERS } from "../architecture-geometry/architecture-geometry-contract";
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
  // Compare in extrusion XY metres, where clipped coordinates become Float32.
  // Exact plan predicates cannot recognize decimal boundaries after that conversion.
  const edges = cuts.flatMap((polygon) => {
    const points = polygon.map((point) => {
      const [x, z] = planPointToWorld(point, coordinates);
      return [x, -z] as const;
    });
    return points.map((a, i) => [a, points[(i + 1) % points.length]] as const);
  });
  const keep: number[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    const vertical =
      Math.max(positions.getZ(i), positions.getZ(i + 1), positions.getZ(i + 2)) -
        Math.min(positions.getZ(i), positions.getZ(i + 1), positions.getZ(i + 2)) >
      1e-8;
    const points = [0, 1, 2].map(
      (offset) => [positions.getX(i + offset), positions.getY(i + offset)] as const,
    );
    const center = [
      points.reduce((sum, p) => sum + p[0], 0) / 3,
      points.reduce((sum, p) => sum + p[1], 0) / 3,
    ];
    const tolerance =
      2 * CLIPPING_GRID_METERS + Math.max(...points.flatMap((p) => p.map(Math.abs))) * 2 ** -23;
    const onCut =
      vertical &&
      edges.some(([a, b]) => {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = Math.hypot(dx, dy);
        if (length === 0) return false;
        const along = ((center[0] - a[0]) * dx + (center[1] - a[1]) * dy) / length;
        // Clipping may merge adjacent collinear cut edges into a longer face.
        // Its centre must belong to a cut and all vertices must share its plane.
        return (
          along >= -tolerance &&
          along <= length + tolerance &&
          points.every(
            (p) => Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length <= tolerance,
          )
        );
      });
    if (!onCut) keep.push(i, i + 1, i + 2);
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
