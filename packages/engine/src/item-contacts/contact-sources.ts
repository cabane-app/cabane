import { Box3, Matrix4, type InstancedMesh, type Material, type Mesh, type Object3D } from "three";
import type { PlanPoint } from "../types";

export type ContactFace = {
  triangle: readonly [PlanPoint, PlanPoint, PlanPoint];
  y: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
export type ReceiverMesh = {
  owner: Object3D;
  mesh: Mesh;
  matrix: Matrix4;
  bounds: Box3;
  faces?: ContactFace[];
};
export type ReceiverGroup = { bounds: Box3; meshes: ReceiverMesh[] };

const flatGround = /^(?:room-|floor-zone-|ground-zone-|platform-finish-|floor-footprint-)/;
const maxSupportTriangles = 40_000;
const maxSupportInstances = 512;
const excluded = (node: Object3D) =>
  !node.visible ||
  !!node.userData.skipStaticBatch ||
  !!node.userData.sceneOutline ||
  node.name.endsWith("-interaction");

export function receivingMaterial(material: (Material & { wireframe?: boolean }) | undefined) {
  return (
    material?.visible &&
    material.colorWrite &&
    material.depthWrite &&
    !material.wireframe &&
    material.opacity >= 0.05
  );
}

/** Find item roots without traversing their models on every Arrange edit. */
export function floorContactSources(floor: Object3D) {
  const items = new Map<Object3D, string>();
  const ground = new Set<Mesh>();
  function visit(node: Object3D) {
    if (excluded(node)) return;
    const deviceId: unknown = node.userData.deviceBindingId;
    if (node.name.startsWith("scene-item-") || typeof deviceId === "string") {
      items.set(
        node,
        typeof deviceId === "string" ? deviceId : node.name.slice("scene-item-".length),
      );
      return;
    }
    if (
      (node as Mesh).isMesh &&
      (flatGround.test(node.name) ||
        node.name === "diorama-ground" ||
        node.name === "elevation-transitions")
    )
      ground.add(node as Mesh);
    for (const child of node.children) visit(child);
  }
  visit(floor);
  return { items, ground };
}

/** Keep actual receiving meshes, bounds and lazily sampled faces in floor-local metres. */
export function contactReceiverGroup(
  floor: Object3D,
  root: Object3D,
  includeChildren: boolean,
): ReceiverGroup {
  root.updateWorldMatrix(true, includeChildren);
  const inverse = floor.matrixWorld.clone().invert();
  const group: ReceiverGroup = { bounds: new Box3(), meshes: [] };
  function insert(mesh: Mesh, matrix: Matrix4) {
    const { geometry } = mesh;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!.clone().applyMatrix4(matrix);
    if (bounds.isEmpty()) return;
    group.bounds.union(bounds);
    group.meshes.push({ mesh, owner: root, matrix, bounds });
  }
  function collect(mesh: Mesh) {
    const { geometry, material } = mesh;
    if (
      mesh.morphTargetInfluences ||
      mesh.type === "SkinnedMesh" ||
      !geometry.hasAttribute("position") ||
      (!Array.isArray(material) && !receivingMaterial(material))
    )
      return;
    const vertexCount = geometry.index?.count ?? geometry.attributes.position.count;
    // Detailed imports can contain millions of triangles or instances.
    if (
      Math.min(vertexCount - geometry.drawRange.start, geometry.drawRange.count) >
      maxSupportTriangles * 3
    )
      return;
    const matrix = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const instances = mesh as InstancedMesh;
    if (!instances.isInstancedMesh) {
      insert(mesh, matrix);
      return;
    }
    if (instances.count > maxSupportInstances) return;
    const instance = new Matrix4();
    for (let i = 0; i < instances.count; i++) {
      instances.getMatrixAt(i, instance);
      insert(mesh, new Matrix4().multiplyMatrices(matrix, instance));
    }
  }
  function visit(node: Object3D) {
    if (excluded(node)) return;
    if ((node as Mesh).isMesh) collect(node as Mesh);
    if (includeChildren) for (const child of node.children) visit(child);
  }
  visit(root);
  return group;
}
