import {
  resolveItemTransform,
  sceneItemPlacementIssues,
  worldPointToPlan,
  type HomeProject,
  type ItemPlacement,
  type SceneItemSpec,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { placementCandidate, type PlacementCandidate } from "./placement-candidate";
import { catalogStartPlacement } from "./catalog-start-placement";

/** An explicit repair changes only this copy's placement, never its imported model. */
export function resetSceneItemPlacement(
  item: SceneItemSpec,
  project: HomeProject,
  definition: SceneModelEditorDescriptor,
): PlacementCandidate {
  const floor = project.floors.find((floor) => floor.id === item.floorId);
  if (!floor) return { placement: null, error: "This item's floor is missing." };
  const scaled = {
    ...definition,
    defaultSize: item.size,
    preferredPlacement: "absolute" as const,
    bounds: {
      min: definition.bounds.min.map(
        (value, axis) => (value * item.size[axis]) / definition.defaultSize[axis],
      ) as [number, number, number],
      max: definition.bounds.max.map(
        (value, axis) => (value * item.size[axis]) / definition.defaultSize[axis],
      ) as [number, number, number],
    },
  };
  let at = floor.coordinates.origin;
  let rotationYRadians = 0;
  try {
    const transform = resolveItemTransform(item.placement, floor);
    at = worldPointToPlan(
      { x: transform.position[0], z: transform.position[2] },
      floor.coordinates,
    );
    rotationYRadians = transform.rotationYRadians;
  } catch {
    // A missing support has no usable anchor; search the floor's valid supports.
  }
  const supported = (placement: ItemPlacement | null) =>
    placement && !sceneItemPlacementIssues({ ...item, placement }, project, definition).length;
  const local = placementCandidate({ definition: scaled }, floor, {
    at,
    kind: "absolute",
    raw: true,
  });
  const placement = supported(local.placement)
    ? local.placement
    : catalogStartPlacement(
        {
          modelId: item.modelId,
          definition: scaled,
        },
        floor,
        at,
      ).placement;
  return placement && supported(placement)
    ? {
        placement: { ...placement, ...(placement.kind === "absolute" ? { rotationYRadians } : {}) },
        error: null,
      }
    : {
        placement: null,
        error: "No suitable floor support is available. Select the item in Arrange or remove it.",
      };
}
