import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  RGBAFormat,
  type Object3D,
} from "three";
import type { PlanPoint } from "../types";
import { polygonSignedArea } from "../geometry";
import type { itemContactFootprints } from "./contact-footprints";
import type { createContactReceiverResolver } from "./contact-receivers";

type Face = readonly [PlanPoint, PlanPoint, PlanPoint];
export const maxContactSpread = 0.045;

function edgeSide(a: PlanPoint, b: PlanPoint, p: PlanPoint) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

// The overlay can only cover the actual receiving face, including at table
// edges, gaps between slats and holes in the floor.
function clipToFace(vertices: PlanPoint[], face: Face): PlanPoint[] {
  const winding = Math.sign(edgeSide(face[0], face[1], face[2]));
  if (!winding) return [];
  let clipped = vertices;
  for (let edge = 0; edge < 3 && clipped.length; edge++) {
    const a = face[edge],
      b = face[(edge + 1) % 3];
    const next: PlanPoint[] = [];
    let prev = clipped[clipped.length - 1];
    let side = winding * edgeSide(a, b, prev);
    for (const point of clipped) {
      const distance = winding * edgeSide(a, b, point);
      if (side < 0 !== distance < 0) {
        const t = side / (side - distance);
        next.push([prev[0] + (point[0] - prev[0]) * t, prev[1] + (point[1] - prev[1]) * t]);
      }
      if (distance >= 0) next.push(point);
      prev = point;
      side = distance;
    }
    clipped = next;
  }
  return clipped;
}

export type ContactPatch = {
  outline: PlanPoint[];
  polygons: PlanPoint[][];
  y: number;
  spread: number;
  opacity: number;
};
export type Footprints = ReturnType<typeof itemContactFootprints>;

export function projectItemContacts(
  item: Object3D,
  footprints: Footprints,
  receiverFor: ReturnType<typeof createContactReceiverResolver>,
): ContactPatch[] {
  const patches: ContactPatch[] = [];
  for (const { polygon, bottomY } of footprints) {
    const xs = polygon.map(([x]) => x),
      zs = polygon.map(([, z]) => z);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    const width = Math.min(maxX - minX, maxZ - minZ);
    const spread = Math.min(maxContactSpread, 0.012 + width * 0.23);
    const receiver = receiverFor(item, polygon, bottomY, spread);
    if (!receiver) continue;
    const gap = Math.max(0, bottomY - receiver.y - 0.002);
    const opacity = 0.32 * Math.max(0, 1 - gap / 0.025);
    if (!opacity) continue;
    const outline = polygonSignedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
    const quad: PlanPoint[] = [
      [minX - spread, minZ - spread],
      [minX - spread, maxZ + spread],
      [maxX + spread, maxZ + spread],
      [maxX + spread, minZ - spread],
    ];
    const polygons = receiver.triangles
      .map((face) => clipToFace(quad, face))
      .filter((p) => p.length >= 3);
    if (polygons.length)
      patches.push({ outline, polygons, y: receiver.y + 0.00035, spread, opacity });
  }
  return patches;
}

/** Pack cached item patches into one draw. Publish geometry and its matching edge texture together. */
export function packItemContacts(items: Iterable<readonly ContactPatch[]>) {
  const positions: number[] = [],
    parameters: number[] = [],
    indices: number[] = [],
    edges: number[] = [];
  for (const patches of items) {
    for (const { outline, polygons, y, spread, opacity } of patches) {
      const firstEdge = edges.length / 4;
      for (let i = 0; i < outline.length; i++) {
        const [x, z] = outline[i],
          next = outline[(i + 1) % outline.length];
        edges.push(x, z, next[0] - x, next[1] - z);
      }
      for (const polygon of polygons) {
        const first = positions.length / 3;
        for (const [x, z] of polygon) {
          positions.push(x, y, z);
          parameters.push(firstEdge, outline.length, spread, opacity);
        }
        for (let i = 2; i < polygon.length; i++) indices.push(first, first + i - 1, first + i);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.userData.preservePlanarFaces = true;
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("contact", new Float32BufferAttribute(parameters, 4));
  geometry.setIndex(indices);
  // Four floats per outline segment. One lookup texture and draw cover the floor.
  const edgeCount = edges.length / 4;
  const columns = Math.max(1, Math.ceil(Math.sqrt(edgeCount)));
  const rows = Math.max(1, Math.ceil(edgeCount / columns));
  const data = new Float32Array(rows * columns * 4);
  data.set(edges);
  const texture = new DataTexture(data, columns, rows, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  return { geometry, texture };
}
