import { Vector3, type Object3D } from "three";
import { pointInsidePolygon } from "../geometry";
import type { PlanPoint } from "../types";
import {
  receivingMaterial,
  type ContactFace,
  type ReceiverGroup,
  type ReceiverMesh,
} from "./contact-sources";

export const contactGap = 0.03;
const coplanar = 0.00025;
const cellSize = 2;

function horizontalFaces(candidate: ReceiverMesh): ContactFace[] {
  if (candidate.faces) return candidate.faces;
  const { mesh, matrix } = candidate;
  const geometry = mesh.geometry,
    position = geometry.getAttribute("position"),
    index = geometry.index;
  const total = index?.count ?? position.count;
  const start = geometry.drawRange.start;
  const end = Math.min(total, start + geometry.drawRange.count);
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  const vertex = (point: Vector3, i: number) =>
    point.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
  const winding = Math.sign(matrix.determinant());
  const faces: ContactFace[] = [];
  for (let i = start; i + 2 < end; i += 3) {
    vertex(a, i);
    vertex(b, i + 1);
    vertex(c, i + 2);
    if (Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > coplanar) continue;
    const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (normalY * winding <= 1e-11) continue;
    if (Array.isArray(mesh.material)) {
      const group = geometry.groups.find((g) => i >= g.start && i < g.start + g.count);
      const material = mesh.material[group?.materialIndex ?? -1];
      if (!receivingMaterial(material)) continue;
    }
    faces.push({
      triangle: [
        [a.x, a.z],
        [b.x, b.z],
        [c.x, c.z],
      ],
      y: (a.y + b.y + c.y) / 3,
      minX: Math.min(a.x, b.x, c.x),
      maxX: Math.max(a.x, b.x, c.x),
      minZ: Math.min(a.z, b.z, c.z),
      maxZ: Math.max(a.z, b.z, c.z),
    });
  }
  candidate.faces = faces;
  return faces;
}

// Both inputs are convex. Positive area excludes a shadow when a foot only grazes an edge.
function overlaps(a: readonly PlanPoint[], b: readonly PlanPoint[]) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length];
      const nx = q[1] - p[1],
        nz = p[0] - q[0];
      if (nx === 0 && nz === 0) continue;
      let amin = Infinity,
        amax = -Infinity,
        bmin = Infinity,
        bmax = -Infinity;
      for (const [x, z] of a) {
        const t = nx * x + nz * z;
        amin = Math.min(amin, t);
        amax = Math.max(amax, t);
      }
      for (const [x, z] of b) {
        const t = nx * x + nz * z;
        bmin = Math.min(bmin, t);
        bmax = Math.max(bmax, t);
      }
      if (amax <= bmin || bmax <= amin) return false;
    }
  }
  return true;
}

/** The grid indexes whole models. Unchanged groups keep their sampled triangles across edits. */
export function createContactReceiverResolver(groups: Iterable<ReceiverGroup>) {
  const cells = new Map<string, ReceiverGroup[]>(),
    wide: ReceiverGroup[] = [];
  const cell = (x: number) => Math.floor(x / cellSize);
  for (const group of groups) {
    const { bounds } = group;
    const x0 = cell(bounds.min.x),
      x1 = cell(bounds.max.x),
      z0 = cell(bounds.min.z),
      z1 = cell(bounds.max.z);
    if (![x0, x1, z0, z1].every(Number.isSafeInteger)) continue;
    // A whole floor occupies many cells but there are very few such surfaces.
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 64) {
      wide.push(group);
      continue;
    }
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const key = `${x}:${z}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(group);
        else cells.set(key, [group]);
      }
  }

  return (
    casterRoot: Object3D,
    patch: readonly PlanPoint[],
    bottomY: number,
    spread: number,
  ): { y: number; triangles: readonly ContactFace["triangle"][] } | null => {
    if (patch.length < 3) return null;
    const xs = patch.map((p) => p[0]),
      zs = patch.map((p) => p[1]);
    const minX = Math.min(...xs) - spread,
      maxX = Math.max(...xs) + spread;
    const minZ = Math.min(...zs) - spread,
      maxZ = Math.max(...zs) + spread;
    if (![minX, maxX, minZ, maxZ].every((v) => Number.isSafeInteger(cell(v)))) return null;
    const center: PlanPoint = [
      xs.reduce((a, b) => a + b, 0) / patch.length,
      zs.reduce((a, b) => a + b, 0) / patch.length,
    ];
    const nearby = new Set(wide);
    // A building-scale imported item may span thousands of unoccupied cells.
    if ((cell(maxX) - cell(minX) + 1) * (cell(maxZ) - cell(minZ) + 1) > 1024) {
      for (const entries of cells.values()) for (const candidate of entries) nearby.add(candidate);
    } else
      for (let x = cell(minX); x <= cell(maxX); x++)
        for (let z = cell(minZ); z <= cell(maxZ); z++) {
          for (const candidate of cells.get(`${x}:${z}`) ?? []) nearby.add(candidate);
        }

    const faces: { face: ContactFace; owner: Object3D }[] = [];
    let support: { y: number; owner: Object3D; centered: boolean } | null = null;
    for (const group of nearby)
      for (const candidate of group.meshes) {
        const { bounds, owner } = candidate;
        if (
          owner === casterRoot ||
          bounds.max.x < minX ||
          bounds.min.x > maxX ||
          bounds.max.z < minZ ||
          bounds.min.z > maxZ ||
          bounds.min.y > bottomY + contactGap ||
          bounds.max.y < bottomY - contactGap
        )
          continue;
        for (const face of horizontalFaces(candidate)) {
          if (
            Math.abs(face.y - bottomY) > contactGap ||
            face.maxX < minX ||
            face.minX > maxX ||
            face.maxZ < minZ ||
            face.minZ > maxZ
          )
            continue;
          faces.push({ face, owner });
          const centered = pointInsidePolygon(center, face.triangle);
          if (
            support &&
            ((support.centered && !centered) ||
              (support.centered === centered && face.y <= support.y + coplanar))
          )
            continue;
          if (centered || overlaps(patch, face.triangle)) support = { y: face.y, owner, centered };
        }
      }
    if (!support) return null;
    const { y, owner } = support;
    return {
      y,
      triangles: faces
        .filter((entry) => entry.owner === owner && Math.abs(entry.face.y - y) <= coplanar)
        .map((entry) => entry.face.triangle),
    };
  };
}
