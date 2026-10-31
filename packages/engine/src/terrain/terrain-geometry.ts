import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { TerrainSurface } from "./terrain-surface";

interface Vertex {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
}
type Axis = "x" | "y";

function clip(vertices: Vertex[], axis: Axis, boundary: number, lower: boolean): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const insideA = lower ? a[axis] <= boundary : a[axis] >= boundary;
    const insideB = lower ? b[axis] <= boundary : b[axis] >= boundary;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (boundary - a[axis]) / (b[axis] - a[axis]);
      result.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        u: a.u + (b.u - a.u) * t,
        v: a.v + (b.v - a.v) * t,
      });
    }
  }
  return result;
}

function splitAt(polygons: Vertex[][], axis: Axis, boundary: number): Vertex[][] {
  return polygons.flatMap((polygon) => {
    const values = polygon.map((point) => point[axis]);
    if (Math.min(...values) >= boundary - 1e-8 || Math.max(...values) <= boundary + 1e-8)
      return [polygon];
    return [clip(polygon, axis, boundary, true), clip(polygon, axis, boundary, false)];
  });
}

/** Split along a shared grid so grass, soil and paths meet every grade break exactly.
 * XY maps to world X/−Z. Preserve UVs, holes and the original hard side normals. */
export function conformToTerrain(
  geometry: BufferGeometry,
  surface: TerrainSurface,
  anchoredDepth?: number,
): BufferGeometry {
  if (!surface) return geometry;
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    uv = geometry.getAttribute("uv");
  const index = geometry.index;
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [];
  const transformedNormal = new Vector3();
  const a = new Vector3(),
    b = new Vector3();
  const count = index?.count ?? position.count;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset));
    const triangle = ids.map((id): Vertex => ({
      x: position.getX(id),
      y: position.getY(id),
      z: position.getZ(id),
      u: uv?.getX(id) ?? 0,
      v: uv?.getY(id) ?? 0,
    }));
    let polygons = [triangle];
    for (const boundary of surface.gridX) polygons = splitAt(polygons, "x", boundary);
    for (const boundary of surface.gridZ) polygons = splitAt(polygons, "y", -boundary);
    for (const polygon of polygons)
      for (let j = 1; j < polygon.length - 1; j++) {
        const vertices = [polygon[0], polygon[j], polygon[j + 1]];
        a.set(
          vertices[1].x - vertices[0].x,
          vertices[1].y - vertices[0].y,
          vertices[1].z - vertices[0].z,
        );
        b.set(
          vertices[2].x - vertices[0].x,
          vertices[2].y - vertices[0].y,
          vertices[2].z - vertices[0].z,
        );
        if (a.cross(b).lengthSq() < 1e-18) continue;
        for (const point of vertices) {
          const { x, y, z, u, v } = point;
          const weight =
            anchoredDepth === undefined ? 1 : Math.max(0, Math.min(1, z / anchoredDepth));
          const delta = 0.001;
          const dx =
            (surface.offsetAt(x + delta, -y) - surface.offsetAt(x - delta, -y)) / (2 * delta);
          const dz =
            (surface.offsetAt(x, -y + delta) - surface.offsetAt(x, -y - delta)) / (2 * delta);
          transformedNormal
            .set(
              normal.getX(ids[0]) - dx * weight * normal.getZ(ids[0]),
              normal.getY(ids[0]) + dz * weight * normal.getZ(ids[0]),
              normal.getZ(ids[0]),
            )
            .normalize();
          positions.push(x, y, z + surface.offsetAt(x, -y) * weight);
          normals.push(...transformedNormal.toArray());
          uvs.push(u, v);
        }
      }
  }
  const conformed = new BufferGeometry();
  conformed.setAttribute("position", new Float32BufferAttribute(positions, 3));
  conformed.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  conformed.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  conformed.computeBoundingBox();
  conformed.computeBoundingSphere();
  geometry.dispose();
  return conformed;
}
