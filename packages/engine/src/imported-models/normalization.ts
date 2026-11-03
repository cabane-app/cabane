import { Box3, Group, Vector3, type AnimationClip, type Object3D } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { applyModelPose } from "./poses";
import { disposeGlbSkeletons } from "./glb-resources";
import type { CustomModelNormalization, CustomModelPlacement, ModelVector } from "./contracts";

export function normalizeGlb(
  root: Object3D,
  placement: CustomModelPlacement,
  rotation: ModelVector = [0, 0, 0],
  scale = 1,
  poses: readonly AnimationClip[] = [],
): CustomModelNormalization {
  if (!Number.isFinite(scale) || scale <= 0 || rotation.some((n) => !Number.isFinite(n)))
    throw new Error("Orientation and scale must be finite; scale must be positive.");
  // Preview parenting must not affect authored coordinates. Measure vertices
  // after rotation rather than rotating an already axis-aligned envelope.
  const measured = new Group();
  measured.rotation.set(...rotation);
  measured.scale.setScalar(scale);
  measured.add(clone(root));
  const bounds = new Box3().setFromObject(measured, true);
  poses.forEach((_, index) => {
    const reset = applyModelPose(measured.children[0]!, poses, String(index));
    bounds.union(new Box3().setFromObject(measured, true));
    reset();
  });
  disposeGlbSkeletons(measured);
  const center = bounds.getCenter(new Vector3());
  const offset: [number, number, number] = [
    -center.x,
    placement === "floor" ? -bounds.min.y : placement === "ceiling" ? -bounds.max.y : -center.y,
    placement === "wall" ? -bounds.min.z : -center.z,
  ];
  bounds.translate(new Vector3(...offset));
  // Flat signs/screens retain a small envelope for editor handles and collision.
  for (const axis of ["x", "y", "z"] as const)
    if (bounds.max[axis] - bounds.min[axis] < 0.001) bounds.max[axis] = bounds.min[axis] + 0.001;
  const size = bounds.getSize(new Vector3()).toArray() as [number, number, number];
  return {
    rotation,
    scale,
    offset,
    size,
    bounds: { min: bounds.min.toArray() as ModelVector, max: bounds.max.toArray() as ModelVector },
  };
}
