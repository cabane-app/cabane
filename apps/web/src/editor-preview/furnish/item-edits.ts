import {
  modelVariants,
  type SceneItemSpec,
  type SceneItemSize,
  type SceneModelEditorDescriptor,
  type ResizePolicy,
  type ItemPlacement,
  type EntityBindingSlotSpec,
} from "@cabane/engine";

const MINIMUM_SIZE_METERS = 0.01;
const positive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.max(MINIMUM_SIZE_METERS, value) : fallback;

export const normalizeSizeForPolicy = (
  defaultSize: SceneItemSize,
  requested: SceneItemSize,
  policy: ResizePolicy,
): SceneItemSize => {
  const safe = requested.map((value, axis) =>
    positive(value, defaultSize[axis]),
  ) as unknown as SceneItemSize;
  if (policy.kind === "fixed") return [...defaultSize];
  if (policy.kind === "planar") return [safe[0], defaultSize[1], safe[2]];
  if (policy.kind === "axes") {
    const allowed = new Set(policy.axes);
    return [
      allowed.has("width") ? safe[0] : defaultSize[0],
      allowed.has("height") ? safe[1] : defaultSize[1],
      allowed.has("depth") ? safe[2] : defaultSize[2],
    ];
  }
  if (policy.kind === "custom") return policy.normalize(defaultSize, safe);

  const changedAxis = safe.findIndex(
    (value, axis) => Math.abs(value / defaultSize[axis] - 1) > 1e-9,
  );
  const scale = changedAxis < 0 ? 1 : safe[changedAxis] / defaultSize[changedAxis];
  return defaultSize.map((value) => value * scale) as unknown as SceneItemSize;
};

export type SceneItemPatch = {
  placement?: ItemPlacement;
  size?: SceneItemSize;
  variant?: string;
  color?: string | null;
  lightState?: "always-off" | "always-on" | "night-only" | "connected";
  entitySlots?: readonly EntityBindingSlotSpec[];
};

/** Validate the complete edit before applying any field or adding an undo step. */
export function editSceneItem(
  item: SceneItemSpec,
  patch: SceneItemPatch,
  definition: SceneModelEditorDescriptor,
): SceneItemSpec {
  if (
    patch.variant !== undefined &&
    !modelVariants(definition).some((variant) => variant.id === patch.variant)
  )
    return item;
  if (
    patch.color !== undefined &&
    (!definition.defaultColor || (patch.color !== null && !/^#[0-9a-f]{6}$/i.test(patch.color)))
  )
    return item;
  if (patch.lightState !== undefined && item.kind !== "device" && !item.lightSlotId) return item;
  const next = {
    ...item,
    ...(patch.placement ? { placement: patch.placement } : {}),
    ...(patch.size
      ? {
          size: normalizeSizeForPolicy(definition.defaultSize, patch.size, definition.resizePolicy),
        }
      : {}),
    ...(patch.variant !== undefined ? { variant: patch.variant } : {}),
    ...(patch.color ? { color: patch.color } : {}),
    ...(patch.entitySlots ? { entitySlots: patch.entitySlots } : {}),
    ...(patch.lightState !== undefined ? { lightState: patch.lightState } : {}),
  };
  if (patch.color === null) delete next.color;
  return next;
}
