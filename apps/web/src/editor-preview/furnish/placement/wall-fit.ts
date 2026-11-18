import type { SceneItemSize, SceneModelEditorDescriptor } from "@cabane/engine";

/** Footprint relative to the wall tangent (X) and its outward normal (Z). */
export function defaultWallFit(
  definition: SceneModelEditorDescriptor,
  size: SceneItemSize = definition.defaultSize,
) {
  const yaw = definition.defaultRotationYRadians ?? 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const scaleX = size[0] / definition.defaultSize[0];
  const scaleZ = size[2] / definition.defaultSize[2];
  const { min, max } = definition.bounds;
  let halfWidth = 0;
  let depthOffset = 0;
  for (const x of [min[0] * scaleX, max[0] * scaleX]) {
    for (const z of [min[2] * scaleZ, max[2] * scaleZ]) {
      halfWidth = Math.max(halfWidth, Math.abs(x * cos + z * sin));
      depthOffset = Math.max(depthOffset, x * sin - z * cos);
    }
  }
  return { halfWidth, depthOffset, yaw };
}
