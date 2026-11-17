import {
  BackSide,
  Matrix4,
  NormalBlending,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
  type MeshPhysicalMaterial,
  type Object3D,
} from "three";
import { ContactSlice } from "./contact-slice";

// Metres above the lowest point. A narrow slice also resolves slightly
// rounded or tilted feet whose mathematical contact is only a line or point.
const sliceDepth = 0.004;
const maxNodes = 384;
const maxTriangles = 40_000;

type Part = {
  geometry: BufferGeometry;
  transform: Matrix4;
  start: number;
  end: number;
  lowerBound: number;
};

function solid(material: Material | undefined) {
  if (!material) return false;
  const surface = material as MeshPhysicalMaterial & { isShaderMaterial?: boolean };
  return (
    surface.visible &&
    surface.colorWrite &&
    surface.depthWrite &&
    !surface.transparent &&
    surface.opacity === 1 &&
    !surface.transmission &&
    !surface.alphaMap &&
    !surface.alphaTest &&
    !surface.alphaHash &&
    !surface.wireframe &&
    !surface.isShaderMaterial &&
    surface.blending === NormalBlending &&
    surface.side !== BackSide &&
    !surface.displacementMap &&
    !surface.clippingPlanes?.length
  );
}

// A floor-local height bound for cheaply rejecting upper parts. The bounds
// may enclose undrawn faces, so only referenced vertices determine bottomY.
function lowestPossibleY(geometry: BufferGeometry, matrix: Matrix4) {
  const box = geometry.boundingBox;
  const e = matrix.elements;
  if (box)
    return (
      e[13] +
      e[1] * (e[1] < 0 ? box.max.x : box.min.x) +
      e[5] * (e[5] < 0 ? box.max.y : box.min.y) +
      e[9] * (e[9] < 0 ? box.max.z : box.min.z)
    );
  const sphere = geometry.boundingSphere;
  if (!sphere) return -Infinity;
  const c = sphere.center;
  return (
    e[13] + e[1] * c.x + e[5] * c.y + e[9] * c.z - sphere.radius * Math.hypot(e[1], e[5], e[9])
  );
}

function solidParts(item: Object3D, floor: Object3D): Part[] {
  floor.updateWorldMatrix(true, false);
  const inverse = new Matrix4().copy(floor.matrixWorld);
  if (Math.abs(inverse.determinant()) < 1e-12) return [];
  inverse.invert();
  item.updateWorldMatrix(true, false);
  const parts: Part[] = [];
  const pending = [item];
  let visited = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (
      !node.visible ||
      node.userData.skipStaticBatch ||
      node.userData.sceneOutline ||
      node.name.endsWith("-interaction")
    )
      continue;
    if (node.animations.length || node.type === "SkinnedMesh") return [];
    if (++visited + pending.length + node.children.length > maxNodes) return [];
    node.updateWorldMatrix(false, false);
    for (const child of node.children) pending.push(child);
    // Skinned, instanced and batched meshes need their own deformation or
    // instance transforms. A rest-pose imprint would be unrelated to them.
    const mesh = node as Mesh;
    if (
      node.type !== "Mesh" ||
      !mesh.isMesh ||
      "isInstancedMesh" in mesh ||
      "isBatchedMesh" in mesh ||
      mesh.morphTargetInfluences
    )
      continue;
    const { geometry, material } = mesh;
    const positions = geometry.getAttribute("position");
    if (!positions || positions.itemSize !== 3 || geometry.morphAttributes.position?.length)
      continue;
    const count = geometry.index?.count ?? positions.count;
    const lo = geometry.drawRange.start;
    const hi = Math.min(count, lo + geometry.drawRange.count);
    const transform = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const lowerBound = lowestPossibleY(geometry, transform);
    function add(start: number, end: number) {
      if (start < end && Number.isSafeInteger(start) && Number.isSafeInteger(end))
        parts.push({ geometry, transform, start, end, lowerBound });
    }
    if (Array.isArray(material)) {
      if (geometry.groups.length > maxNodes) return [];
      for (const group of geometry.groups)
        if (solid(material[group.materialIndex ?? 0]))
          add(Math.max(lo, group.start), Math.min(hi, group.start + group.count));
    } else if (solid(material)) add(lo, hi);
    if (parts.length > maxNodes * 2) return [];
  }
  return parts.sort((a, b) => a.lowerBound - b.lowerBound || a.end - a.start - (b.end - b.start));
}

/**
 * Ordered convex contact patches in floor-local XZ, with their actual floor-local
 * base elevations. Sample on item/placement changes, outside the render loop.
 * A model outside the CPU budget gets no speculative whole-item footprint.
 */
export function itemContactFootprints(itemRoot: Object3D, floorRoot: Object3D) {
  const parts = solidParts(itemRoot, floorRoot);
  const candidates: (Part & { bottom: number })[] = [];
  let lowest = Infinity;
  let remaining = maxTriangles * 3;
  for (const part of parts) {
    if (part.lowerBound > lowest + sliceDepth) break;
    const { start, end, geometry, transform } = part;
    remaining -= end - start;
    if (remaining < 0) return [];
    const positions = geometry.getAttribute("position");
    const e = transform.elements;
    let bottom = Infinity;
    for (let i = start; i < end; i++) {
      const id = geometry.index?.getX(i) ?? i;
      const y =
        e[1] * positions.getX(id) + e[5] * positions.getY(id) + e[9] * positions.getZ(id) + e[13];
      if (!Number.isFinite(y)) return [];
      bottom = Math.min(bottom, y);
    }
    lowest = Math.min(lowest, bottom);
    candidates.push({ ...part, bottom });
  }
  const ceiling = lowest + sliceDepth;
  const slice = new ContactSlice(ceiling);
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  for (const { bottom, start, end, geometry, transform } of candidates) {
    if (bottom > ceiling) continue;
    const positions = geometry.getAttribute("position");
    for (let i = start; i + 2 < end; i += 3) {
      for (let j = 0; j < 3; j++)
        vertices[j]
          .fromBufferAttribute(positions, geometry.index?.getX(i + j) ?? i + j)
          .applyMatrix4(transform);
      if (!slice.add(vertices)) return [];
    }
  }
  return slice.footprints();
}
