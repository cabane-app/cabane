import {
  Box3,
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SceneItemSize } from "@cabane/engine";

export type Point = [number, number, number];
export function branch(start: Point, end: Point, radius: number, tip = radius * 0.35) {
  const a = new Vector3(...start),
    b = new Vector3(...end);
  const direction = b.clone().sub(a);
  const geometry = new CylinderGeometry(tip, radius, direction.length(), 7);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
  );
  geometry.translate(...a.add(b).multiplyScalar(0.5).toArray());
  return geometry;
}
export function foliage(center: Point, scale: Point, detail = 1) {
  const geometry = new IcosahedronGeometry(1, detail);
  geometry.scale(...scale).translate(...center);
  return geometry;
}
export function finish(wood: BufferGeometry[], leaves: BufferGeometry[], size: SceneItemSize) {
  const merge = (source: BufferGeometry[]) => {
    const normalized = source.map((part) => (part.index ? part.toNonIndexed() : part));
    const result = mergeGeometries(normalized);
    normalized.forEach((part, index) => {
      if (part !== source[index]) part.dispose();
    });
    return result;
  };
  const parts = { wood: merge(wood), leaves: merge(leaves) };
  [...wood, ...leaves].forEach((part) => part.dispose());
  const bounds = new Box3();
  Object.values(parts).forEach((part) => {
    part.computeBoundingBox();
    bounds.union(part.boundingBox!);
  });
  const extent = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  const matrix = new Matrix4()
    .makeScale(size[0] / extent.x, size[1] / extent.y, size[2] / extent.z)
    .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
  Object.values(parts).forEach((part) => part.applyMatrix4(matrix));
  return parts;
}
