import {
  resolveItemTransform,
  type FloorSpec,
  type SceneItemSpec,
  type SceneModelEditorDescriptor,
  type ProjectModelRegistries,
} from "@cabane/engine";
import { selectionBoxGeometry } from "./editor-state";
import { groupPlacement, itemGroupTransform } from "./group-transforms";
import { missingModelEditorDescriptor } from "./missing-model";

/** Adapt an assembly's actual oriented bounds to the existing item controls. */
export function furnishingSelectionTarget(
  items: readonly SceneItemSpec[],
  floor: FloorSpec,
  registries: Pick<ProjectModelRegistries, "furnishingModels" | "deviceModels">,
  label: string,
) {
  const pivot = itemGroupTransform(items, floor);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const item of items) {
    const definition =
      (item.kind === "device" ? registries.deviceModels : registries.furnishingModels)[
        item.modelId
      ] ?? missingModelEditorDescriptor(item);
    const box = selectionBoxGeometry(item, definition);
    const transform = resolveItemTransform(item.placement, floor);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const x = box.center[0] + (sx * box.size[0]) / 2,
            z = box.center[2] + (sz * box.size[2]) / 2;
          const dx =
            transform.position[0] +
            x * Math.cos(transform.rotationYRadians) +
            z * Math.sin(transform.rotationYRadians) -
            pivot.position[0];
          const dz =
            transform.position[2] -
            x * Math.sin(transform.rotationYRadians) +
            z * Math.cos(transform.rotationYRadians) -
            pivot.position[2];
          const point = [
            dx * Math.cos(pivot.rotationYRadians) - dz * Math.sin(pivot.rotationYRadians),
            transform.position[1] + box.center[1] + (sy * box.size[1]) / 2 - pivot.position[1],
            dx * Math.sin(pivot.rotationYRadians) + dz * Math.cos(pivot.rotationYRadians),
          ];
          point.forEach((value, axis) => {
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value);
          });
        }
  }
  const size = min.map((value, axis) => Math.max(0.04, max[axis] - value)) as [
    number,
    number,
    number,
  ];
  const item: SceneItemSpec = {
    ...items[0],
    kind: "furnishing",
    placement: groupPlacement(items, floor),
    size,
  };
  const definition: SceneModelEditorDescriptor = {
    ...missingModelEditorDescriptor(item),
    label,
    defaultSize: size,
    bounds: { min: min as [number, number, number], max: max as [number, number, number] },
    resizePolicy: { kind: "fixed" },
  };
  return {
    item,
    definition,
    position: pivot.position,
    rotation: pivot.rotationYRadians,
    box: selectionBoxGeometry(item, definition),
  };
}
