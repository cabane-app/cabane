import { roomIdForItem } from "./item-rooms";
import { roomsForFloor } from "../outdoor-platforms/platform-rooms";
import { pointOnFloorSupport } from "../outdoor-platforms/platform-geometry";
import { modelVariants } from "../model-variants";
import { modelLightingExecution, SCENE_LIGHT_BUDGET } from "../model-lighting/execution";
import { lightingModelId } from "../model-lighting/settings";
import { recoverModelLighting } from "../validation/recover-model-lighting";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import { pointInsidePolygon, worldPointToPlan } from "../geometry";
import { pointStrictlyOutsideFloorFootprint } from "../floor-finishes/finish-geometry";
import type { FloorSpec, ProjectModelRegistries, SceneModelEditorDescriptor } from "../types";
import { resolveItemTransform } from "./placements";
import { validateDeviceSlotsAgainstModel } from "./profiles";
import type { HomeProject, SceneItemSpec } from "./types";
import { addProjectIssue, addProjectWarning, type HomeProjectIssue } from "./validation-types";

const roomIdsForItem = (
  item: SceneItemSpec,
  project: { floors: readonly FloorSpec[] },
): readonly string[] => {
  const floor = project.floors.find((candidate) => candidate.id === item.floorId);
  if (!floor) return [];
  const transform = resolveItemTransform(item.placement, floor);
  const at = worldPointToPlan(
    { x: transform.position[0], z: transform.position[2] },
    floor.coordinates,
  );
  return roomsForFloor(floor)
    .filter((room) => pointInsidePolygon(at, room.polygon))
    .map((room) => room.id);
};

export const resolvedRoomIdForItem = (
  item: SceneItemSpec,
  project: { floors: readonly FloorSpec[] },
  definition?: SceneModelEditorDescriptor,
): string | null => {
  if (definition?.windowFit?.mounting === "exterior-recessed") {
    const floor = project.floors.find((candidate) => candidate.id === item.floorId);
    return floor ? roomIdForItem(item, floor, definition) : null;
  }
  const roomIds = roomIdsForItem(item, project);
  if (roomIds.length !== 1) return null;
  if (item.placement.kind === "ceiling" && roomIds[0] !== item.placement.roomId) return null;
  return roomIds[0];
};

const validatePlacementBounds = (
  item: SceneItemSpec,
  path: string,
  project: { floors: readonly FloorSpec[] },
  issues: HomeProjectIssue[],
  definition: SceneModelEditorDescriptor | undefined,
) => {
  const floor = project.floors.find((candidate) => candidate.id === item.floorId);
  if (!floor) return;
  const placement = item.placement;
  const heightScale = definition ? item.size[1] / definition.defaultSize[1] : 1;
  const minimumY = (definition?.bounds.min[1] ?? 0) * heightScale;
  const maximumY = definition ? definition.bounds.max[1] * heightScale : item.size[1];
  if (placement.kind === "absolute") {
    if (
      floor.id !== project.floors.find((floor) => !floor.belowGround)?.id &&
      !pointOnFloorSupport(placement.at, floor)
    )
      addProjectWarning(
        issues,
        "project.item-support",
        path,
        "Place the item on a room floor or outdoor platform.",
      );
    const onOutdoorGround =
      !floor.outdoorPlatforms?.some((p) => pointInsidePolygon(placement.at, p.polygon)) &&
      floor.id === project.floors.find((floor) => !floor.belowGround)?.id &&
      pointStrictlyOutsideFloorFootprint(placement.at, floor);
    const minimumElevation = onOutdoorGround ? GROUND_ELEVATION_METERS : 0;
    if (placement.elevationMeters + minimumY < minimumElevation - 1e-8) {
      addProjectWarning(
        issues,
        "project.item-elevation",
        `${path}.elevationMeters`,
        "The item extends below the floor. Raise it or reset its placement in Arrange.",
      );
    }
    return;
  }
  if (placement.kind === "wall") {
    const wall = floor.walls.find((candidate) => candidate.id === placement.wallId);
    if (!wall) return;
    const wallLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    if (
      placement.offsetFromWallStartPlanUnits < 0 ||
      placement.offsetFromWallStartPlanUnits > wallLength
    ) {
      addProjectWarning(
        issues,
        "project.wall-support-span",
        `${path}.offsetFromWallStartPlanUnits`,
        `Wall attachment must remain within wall “${wall.id}”.`,
      );
    }
    const wallHeight = wall.heightMeters ?? floor.defaultWallHeightMeters;
    const bottom = placement.elevationMeters + minimumY;
    const top = placement.elevationMeters + maximumY;
    if (placement.elevationMeters < 0 || bottom < -1e-8 || top > wallHeight + 1e-8) {
      addProjectWarning(
        issues,
        "project.wall-support-height",
        `${path}.elevationMeters`,
        `Wall attachment must fit between the floor and ${wallHeight} metres.`,
      );
    }
    return;
  }
  const ceiling = floor.ceilings?.find((candidate) => candidate.roomIds.includes(placement.roomId));
  const height = ceiling?.kind === "flat" ? ceiling.heightMeters : floor.defaultCeilingHeightMeters;
  if (
    placement.dropMeters < 0 ||
    placement.dropMeters > height ||
    height - placement.dropMeters + minimumY < -1e-8 ||
    // Native ceiling devices can include recessed geometry above their anchor.
    // Imported GLBs have an explicit normalized support origin instead.
    (item.modelId.startsWith("custom:") && maximumY - placement.dropMeters > 1e-8)
  ) {
    addProjectWarning(
      issues,
      "project.ceiling-drop",
      `${path}.dropMeters`,
      "The item must fit below the ceiling and above the floor. Reset its placement or adjust its drop.",
    );
  }
};

/** Shared by saved-project diagnostics and Arrange's edit guard. */
export const sceneItemPlacementIssues = (
  item: SceneItemSpec,
  project: { floors: readonly FloorSpec[] },
  definition: SceneModelEditorDescriptor | undefined,
  path = "placement",
): readonly HomeProjectIssue[] => {
  const issues: HomeProjectIssue[] = [];
  const floor = project.floors.find((candidate) => candidate.id === item.floorId);
  if (!floor) return issues;
  const placement = item.placement;
  let supportExists = true;
  if (placement.kind === "wall" && !floor.walls.some((wall) => wall.id === placement.wallId)) {
    supportExists = false;
    addProjectIssue(
      issues,
      "project.wall-support-missing",
      `${path}.wallId`,
      `Wall “${placement.wallId}” does not exist.`,
    );
  }
  if (
    placement.kind === "wall" &&
    floor.walls.some((wall) => wall.id === placement.wallId && wall.virtual === true)
  ) {
    supportExists = false;
    addProjectIssue(
      issues,
      "project.wall-support-virtual",
      `${path}.wallId`,
      "Invisible walls divide rooms and cannot support items. Choose a physical wall or floor placement.",
    );
  }
  if (placement.kind === "ceiling" && !floor.rooms.some((room) => room.id === placement.roomId)) {
    addProjectIssue(
      issues,
      "project.ceiling-room-missing",
      `${path}.roomId`,
      `Room “${placement.roomId}” does not exist.`,
    );
  }
  validatePlacementBounds(item, path, project, issues, definition);
  if (!supportExists) return issues;

  const roomIds = roomIdsForItem(item, project);
  if (definition?.placementEnvironment === "outdoor") {
    const transform = resolveItemTransform(item.placement, floor);
    const at =
      item.placement.kind === "absolute"
        ? item.placement.at
        : worldPointToPlan(
            {
              x: transform.position[0],
              z: transform.position[2],
            },
            floor.coordinates,
          );
    if (
      item.placement.kind !== "absolute" ||
      (!floor.outdoorPlatforms?.some((p) => pointInsidePolygon(at, p.polygon)) &&
        !pointStrictlyOutsideFloorFootprint(at, floor))
    ) {
      addProjectWarning(
        issues,
        "project.outdoor-placement",
        path,
        "Outdoor items require absolute ground placement outside the building footprint.",
      );
    }
    return issues;
  }
  if (roomIds.length === 0 && placement.kind === "ceiling") {
    addProjectWarning(
      issues,
      "project.room-membership-missing",
      path,
      "The resolved item placement must belong to one room.",
    );
  } else if (roomIds.length > 1) {
    addProjectWarning(
      issues,
      "project.room-membership-ambiguous",
      path,
      "The resolved item placement belongs to more than one room.",
    );
  } else if (
    placement.kind === "ceiling" &&
    roomIds.length === 1 &&
    roomIds[0] !== placement.roomId
  ) {
    addProjectWarning(
      issues,
      "project.ceiling-room-mismatch",
      `${path}.roomId`,
      `Ceiling placement declares room “${placement.roomId}” but its point belongs to room “${roomIds[0]}”.`,
    );
  }
  return issues;
};

export const validateSceneItemsAndSupports = (
  project: HomeProject,
  registries: ProjectModelRegistries,
  issues: HomeProjectIssue[],
) => {
  const lightingWarnings = new Map(
    recoverModelLighting({ extensions: registries }).issues.map((issue) => [issue.path, issue]),
  );
  const groups = new Map<string, SceneItemSpec>();
  project.sceneItems.forEach((item, index) => {
    const itemPath = `sceneItems[${index}]`;
    if (item.group) {
      const member = groups.get(item.group.id);
      if (member && (member.floorId !== item.floorId || member.group?.name !== item.group.name))
        addProjectIssue(
          issues,
          "project.item-group",
          `${itemPath}.group`,
          "Group members must share one floor and group name. Ungroup them in Arrange to edit separately.",
        );
      else groups.set(item.group.id, item);
    }
    const floor = project.floors.find((candidate) => candidate.id === item.floorId);
    if (!floor) {
      addProjectIssue(
        issues,
        "project.item-floor-missing",
        `${itemPath}.floorId`,
        "The item floor does not exist.",
      );
      return;
    }
    const registry = item.kind === "device" ? registries.deviceModels : registries.furnishingModels;
    const definition = Object.hasOwn(registry, item.modelId) ? registry[item.modelId] : undefined;
    if (!definition) {
      addProjectWarning(
        issues,
        "project.model-missing",
        `${itemPath}.modelId`,
        `Model “${item.modelId}” is unavailable. A placeholder is shown. Its placement and connections are kept.`,
      );
    } else {
      const lightingWarning =
        lightingWarnings.get(
          `extensions.${item.kind === "device" ? "deviceModels" : "furnishingModels"}.${item.modelId}`,
        ) ?? lightingWarnings.get(`extensions.deviceModels.${lightingModelId(item.modelId)}`);
      if (lightingWarning)
        addProjectWarning(
          issues,
          "project.model-lighting-disabled",
          `${itemPath}.modelId`,
          lightingWarning.message,
        );
      else if (definition.lighting) {
        const execution = modelLightingExecution(definition.lighting);
        if (execution.approximated)
          addProjectWarning(
            issues,
            "project.model-lighting-approximation",
            `${itemPath}.modelId`,
            `“${definition.label}” requests ${execution.requested.toLocaleString("en")} light samples. The scene shares ${SCENE_LIGHT_BUDGET} physical lights; coverage is approximated while saved sources and total brightness are preserved.`,
          );
      }
      if (
        item.lightSlotId &&
        (!definition.lighting ||
          (item.kind === "device" &&
            item.entitySlots.some(
              (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
            )))
      )
        addProjectIssue(
          issues,
          "project.light-relationship",
          `${itemPath}.lightSlotId`,
          "An independent lighting relationship requires model lighting and no existing primary light slot.",
        );
      if (
        item.variant !== undefined &&
        !modelVariants(definition).some((variant) => variant.id === item.variant)
      ) {
        addProjectWarning(
          issues,
          "project.variant-missing",
          `${itemPath}.variant`,
          `Variant “${item.variant}” is not available for model “${item.modelId}”; its default variant will be shown until it is available.`,
        );
      }
      if (
        item.modelId.startsWith("custom:") &&
        item.size.some(
          (dimension, axis) =>
            Math.abs(
              dimension / definition.defaultSize[axis] - item.size[0] / definition.defaultSize[0],
            ) > 0.000001,
        )
      ) {
        addProjectIssue(
          issues,
          "project.custom-model-scale",
          `${itemPath}.size`,
          "Imported models use uniform scaling. Restore matching proportions.",
        );
      }
      if (item.kind === "device")
        validateDeviceSlotsAgainstModel(
          item,
          definition as ProjectModelRegistries["deviceModels"][string],
          index,
          issues,
        );
    }

    item.size.forEach((value, axis) => {
      if (!Number.isFinite(value) || value <= 0) {
        addProjectIssue(
          issues,
          "project.item-size",
          `${itemPath}.size[${axis}]`,
          "Item dimensions must be positive finite metres.",
        );
      }
    });
    issues.push(...sceneItemPlacementIssues(item, project, definition, `${itemPath}.placement`));
  });
};
