import { Box3, InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from "three";
import type { BoxWalkCollider } from "../navigation/walk-navigation-contract";
import { CUSTOM_MODEL_LIMITS } from "./contracts";

const CELL_METERS = 0.08;
const MAX_GRID_SIDE = 64;
const MAX_CELL_TESTS = 250_000;
const MAX_EDGE_TESTS = 600_000;
const MAX_BOXES = 256;
const HEIGHT_BUCKET_METERS = 0.05;
const EPSILON = 1e-7;

type HeightRange = { minY: number; maxY: number };
const cached = new WeakMap<Object3D, { key: string; boxes: BoxWalkCollider[] | null }>();

/** Clip in 3D so sloped faces keep their height at each occupied floor cell. */
function clip(points: readonly Vector3[], axis: "x" | "z", edge: number, sign: number) {
  const result: Vector3[] = [];
  if (!points.length) return result;
  let previous = points[points.length - 1];
  let before = (previous[axis] - edge) * sign;
  for (const point of points) {
    const after = (point[axis] - edge) * sign;
    if (before < 0 !== after < 0)
      result.push(previous.clone().lerp(point, before / (before - after)));
    if (after >= 0) result.push(point);
    previous = point;
    before = after;
  }
  return result;
}

function meshKey(mesh: Mesh) {
  return [
    mesh.uuid,
    mesh.geometry.uuid,
    ...mesh.matrixWorld.elements,
    ...(mesh.morphTargetInfluences ?? []),
    ...(mesh instanceof InstancedMesh ? [mesh.count, mesh.instanceMatrix.version] : []),
  ].join(",");
}

/**
 * Immutable loaded GLBs share buffers, but each placed hierarchy owns its world
 * footprint. A failed budget returns null, preserving the old envelope collider.
 */
export function importedWalkFootprint(
  root: Object3D,
  meshes: readonly Mesh[],
  bounds: Box3,
): readonly BoxWalkCollider[] | null {
  const key = meshes.map(meshKey).join("|");
  const previous = cached.get(root);
  if (previous?.key === key) return previous.boxes;
  const boxes = rasterize(root.uuid, meshes, bounds);
  cached.set(root, { key, boxes });
  return boxes;
}

function rasterize(id: string, meshes: readonly Mesh[], bounds: Box3): BoxWalkCollider[] | null {
  if (meshes.length > CUSTOM_MODEL_LIMITS.meshes) return null;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (![width, depth, bounds.max.y - bounds.min.y].every(Number.isFinite)) return null;
  const cell = Math.max(CELL_METERS, width / MAX_GRID_SIDE, depth / MAX_GRID_SIDE);
  const columns = Math.max(1, Math.min(MAX_GRID_SIDE, Math.ceil(width / cell)));
  const rows = Math.max(1, Math.min(MAX_GRID_SIDE, Math.ceil(depth / cell)));
  const length = columns * rows;
  const minY = new Float64Array(length);
  const maxY = new Float64Array(length);
  const geometry = connectedTriangles(meshes, bounds, cell, columns, rows);
  if (!geometry) return null;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  const boxes: BoxWalkCollider[] = [];

  for (const component of geometry.components) {
    minY.fill(Infinity);
    maxY.fill(-Infinity);
    for (const triangle of component) {
      a.fromArray(geometry.vertices, triangle * 9);
      b.fromArray(geometry.vertices, triangle * 9 + 3);
      c.fromArray(geometry.vertices, triangle * 9 + 6);
      const range = geometry.ranges[triangle];
      const startX = range & 63,
        endX = (range >>> 6) & 63;
      const startZ = (range >>> 12) & 63,
        endZ = range >>> 18;
      for (let z = startZ; z <= endZ; z++)
        for (let x = startX; x <= endX; x++) {
          const left = bounds.min.x + x * cell,
            front = bounds.min.z + z * cell;
          let polygon = clip([a, b, c], "x", left, 1);
          polygon = clip(polygon, "x", left + cell, -1);
          polygon = clip(polygon, "z", front, 1);
          polygon = clip(polygon, "z", front + cell, -1);
          const index = z * columns + x;
          for (const vertex of polygon) {
            minY[index] = Math.min(minY[index], vertex.y);
            maxY[index] = Math.max(maxY[index], vertex.y);
          }
        }
    }
    // Shared edges connect material primitives into one solid. Disconnected
    // components (a rug below a shelf) keep independent vertical ranges.
    const groups = new Map<string, Map<number, HeightRange>>();
    for (let index = 0; index < length; index++) {
      if (minY[index] === Infinity) continue;
      const key = `${Math.floor((minY[index] + EPSILON) / HEIGHT_BUCKET_METERS)}:${Math.ceil((maxY[index] - EPSILON) / HEIGHT_BUCKET_METERS)}`;
      let cells = groups.get(key);
      if (!cells) groups.set(key, (cells = new Map<number, HeightRange>()));
      cells.set(index, { minY: minY[index], maxY: maxY[index] });
    }
    for (const cells of groups.values())
      for (const index of cells.keys()) {
        const x = index % columns,
          z = Math.floor(index / columns);
        let endX = x + 1,
          endZ = z + 1;
        while (endX < columns && cells.has(z * columns + endX)) endX++;
        while (endZ < rows) {
          let complete = true;
          for (let column = x; column < endX; column++)
            if (!cells.has(endZ * columns + column)) {
              complete = false;
              break;
            }
          if (!complete) break;
          endZ++;
        }
        let bottom = Infinity,
          top = -Infinity;
        for (let row = z; row < endZ; row++)
          for (let column = x; column < endX; column++) {
            const occupied = row * columns + column;
            const range = cells.get(occupied)!;
            bottom = Math.min(bottom, range.minY);
            top = Math.max(top, range.maxY);
            cells.delete(occupied);
          }
        if (boxes.length === MAX_BOXES) return null;
        boxes.push({
          kind: "box",
          id: `${id}:footprint:${boxes.length}`,
          minX: bounds.min.x + x * cell,
          maxX: Math.min(bounds.max.x, bounds.min.x + endX * cell),
          minZ: bounds.min.z + z * cell,
          maxZ: Math.min(bounds.max.z, bounds.min.z + endZ * cell),
          minY: bottom,
          maxY: top,
        });
      }
  }
  return boxes;
}

function componentRoot(parents: Int32Array, index: number): number {
  let root = index;
  while (parents[root] >= 0) root = parents[root];
  while (index !== root) {
    const next = parents[index];
    parents[index] = root;
    index = next;
  }
  return root;
}

/** Build edge-connected world triangles independently of GLB primitive/material splits. */
function connectedTriangles(
  meshes: readonly Mesh[],
  bounds: Box3,
  cell: number,
  columns: number,
  rows: number,
) {
  let count = 0;
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position");
    const vertices = mesh.geometry.index?.count ?? positions?.count ?? 0;
    const instances = mesh instanceof InstancedMesh ? mesh.count : 1;
    if (
      !positions ||
      vertices % 3 !== 0 ||
      !Number.isSafeInteger(instances) ||
      instances < 1 ||
      (mesh instanceof InstancedMesh && mesh.morphTexture) ||
      (count += (vertices / 3) * instances) > CUSTOM_MODEL_LIMITS.triangles
    )
      return null;
  }
  const vertices = new Float64Array(count * 9);
  const ranges = new Uint32Array(count);
  const parents = new Int32Array(count).fill(-1);
  const edgeNext = new Int32Array(count * 3);
  const edges = new Map<number, number>();
  const origin = bounds.min.toArray();
  const size = bounds.getSize(new Vector3());
  const tolerance = Math.max(1e-6, size.x * 1e-9, size.y * 1e-9, size.z * 1e-9);
  const quantized = (index: number, axis: number) =>
    Math.round((vertices[index + axis] - origin[axis]) / tolerance);
  const samePoint = (left: number, right: number) =>
    quantized(left, 0) === quantized(right, 0) &&
    quantized(left, 1) === quantized(right, 1) &&
    quantized(left, 2) === quantized(right, 2);
  const pointHash = (index: number) =>
    Math.imul(quantized(index, 0), 73856093) ^
    Math.imul(quantized(index, 1), 19349663) ^
    Math.imul(quantized(index, 2), 83492791);
  const instanceMatrix = new Matrix4(),
    worldMatrix = new Matrix4();
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  let triangle = 0,
    tests = 0,
    edgeTests = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const count = geometry.index?.count ?? geometry.getAttribute("position").count;
    const instances = mesh instanceof InstancedMesh ? mesh.count : 1;
    for (let instance = 0; instance < instances; instance++) {
      worldMatrix.copy(mesh.matrixWorld);
      if (mesh instanceof InstancedMesh) {
        mesh.getMatrixAt(instance, instanceMatrix);
        worldMatrix.multiply(instanceMatrix);
      }
      for (let vertex = 0; vertex < count; vertex += 3, triangle++) {
        const base = triangle * 9;
        for (const [offset, point] of [
          [0, a],
          [1, b],
          [2, c],
        ] as const) {
          mesh.getVertexPosition(geometry.index?.getX(vertex + offset) ?? vertex + offset, point);
          point.applyMatrix4(worldMatrix);
          if (![point.x, point.y, point.z].every(Number.isFinite)) return null;
          point.toArray(vertices, base + offset * 3);
        }
        const startX = Math.max(
          0,
          Math.min(columns - 1, Math.floor((Math.min(a.x, b.x, c.x) - bounds.min.x) / cell)),
        );
        const endX = Math.max(
          startX,
          Math.min(columns - 1, Math.ceil((Math.max(a.x, b.x, c.x) - bounds.min.x) / cell) - 1),
        );
        const startZ = Math.max(
          0,
          Math.min(rows - 1, Math.floor((Math.min(a.z, b.z, c.z) - bounds.min.z) / cell)),
        );
        const endZ = Math.max(
          startZ,
          Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z, c.z) - bounds.min.z) / cell) - 1),
        );
        if ((tests += (endX - startX + 1) * (endZ - startZ + 1)) > MAX_CELL_TESTS) return null;
        // Six bits per coordinate cover the bounded 64-by-64 grid.
        ranges[triangle] = startX | (endX << 6) | (startZ << 12) | (endZ << 18);
        for (let edge = 0; edge < 3; edge++) {
          const from = base + edge * 3,
            to = base + ((edge + 1) % 3) * 3;
          const first = pointHash(from),
            second = pointHash(to);
          const hash =
            Math.imul(Math.min(first, second), 0x85ebca6b) ^
            Math.imul(Math.max(first, second), 0xc2b2ae35);
          const head = edges.get(hash) ?? -1;
          let other = head;
          while (other >= 0) {
            if (++edgeTests > MAX_EDGE_TESTS) return null;
            const otherTriangle = Math.floor(other / 3),
              otherEdge = other % 3;
            const otherFrom = otherTriangle * 9 + otherEdge * 3;
            const otherTo = otherTriangle * 9 + ((otherEdge + 1) % 3) * 3;
            if (
              (samePoint(from, otherFrom) && samePoint(to, otherTo)) ||
              (samePoint(from, otherTo) && samePoint(to, otherFrom))
            ) {
              let left = componentRoot(parents, triangle),
                right = componentRoot(parents, otherTriangle);
              if (left !== right) {
                if (parents[left] > parents[right]) [left, right] = [right, left];
                parents[left] += parents[right];
                parents[right] = left;
              }
              break;
            }
            other = edgeNext[other];
          }
          if (other < 0) {
            const index = triangle * 3 + edge;
            edgeNext[index] = head;
            edges.set(hash, index);
          }
        }
      }
    }
  }
  const components = new Map<number, number[]>();
  for (let triangle = 0; triangle < count; triangle++) {
    const root = componentRoot(parents, triangle);
    let component = components.get(root);
    if (!component) {
      if (components.size === MAX_BOXES) return null;
      components.set(root, (component = []));
    }
    component.push(triangle);
  }
  return { vertices, ranges, components: components.values() };
}
