import { planPointToWorld, pointInsidePolygon, polygonCentroid } from "./geometry";
import type {
  DeviceSlotSpec,
  DeviceModelDefinition,
  DeviceModelRegistry,
  DeviceVisualState,
  EntityStateSnapshot,
  FloorCoordinates,
  FloorSpec,
  HomeExtensionRegistry,
  ManifestIssue,
  RoomSpec,
  SceneModelEditorDescriptor,
  WallDevicePlacement,
} from "./types";

export const SURFACE_CONTACT_MIN_METERS = 0;
export const SURFACE_CONTACT_MAX_METERS = 0.002;
export const WALL_CONTACT_MIN_METERS = 0;
export const WALL_CONTACT_MAX_METERS = 0.002;
export const OUTLINED_WALL_CONTACT_MIN_METERS = 0.002;
export const OUTLINED_WALL_CONTACT_MAX_METERS = 0.005;
export const WALL_ALIGNMENT_TOLERANCE_RADIANS = Math.PI / 90;

const inactiveStates = new Set(["closed", "idle", "off", "paused", "standby"]);

export const deviceVisualStateForSnapshot = (
  snapshot: EntityStateSnapshot | undefined,
): DeviceVisualState => {
  if (!snapshot || snapshot.stale) return "disconnected";
  if (!snapshot.available || ["unknown", "unavailable"].includes(snapshot.state)) {
    return "unavailable";
  }
  if (snapshot.entityId.startsWith("event.")) return "connected-inactive";
  return inactiveStates.has(snapshot.state) ? "connected-inactive" : "connected-active";
};

export const defineDeviceModel = <T extends DeviceModelDefinition>(definition: T) => definition;

export const defineDeviceModelRegistry = <T extends DeviceModelRegistry>(registry: T) => registry;

export const defineHomeExtensionRegistry = <T extends HomeExtensionRegistry>(registry: T) =>
  registry;

export const resolveDeviceModelDefinition = (
  modelId: string,
  stableModels: DeviceModelRegistry,
  extensionModels: DeviceModelRegistry,
): DeviceModelDefinition | undefined =>
  Object.hasOwn(stableModels, modelId)
    ? stableModels[modelId]
    : Object.hasOwn(extensionModels, modelId)
      ? extensionModels[modelId]
      : undefined;

export const mergeDeviceModelRegistriesStableFirst = (
  stableModels: DeviceModelRegistry,
  extensionModels: DeviceModelRegistry,
): DeviceModelRegistry => {
  const merged: Record<string, DeviceModelDefinition> = Object.create(null) as Record<
    string,
    DeviceModelDefinition
  >;
  for (const modelId of new Set([...Object.keys(extensionModels), ...Object.keys(stableModels)])) {
    const definition = resolveDeviceModelDefinition(modelId, stableModels, extensionModels);
    if (definition) merged[modelId] = definition;
  }
  return merged;
};

export const uniformDeviceScaleForSize = (
  size: readonly [number, number, number],
  definition: SceneModelEditorDescriptor,
): number | null => {
  const extents = definition.bounds.max.map(
    (maximum, axis) => maximum - definition.bounds.min[axis],
  );
  if (extents.some((extent) => !Number.isFinite(extent) || extent <= 0)) return null;
  const ratios = size.map((dimension, axis) => dimension / extents[axis]);
  if (ratios.some((ratio) => !Number.isFinite(ratio) || ratio <= 0)) return null;
  const [scale] = ratios;
  return ratios.every((ratio) => Math.abs(ratio - scale) <= 1e-6) ? scale : null;
};

export interface DeviceWorldTransform {
  position: readonly [x: number, y: number, z: number];
  rotationYRadians: number;
  scale: number;
}

export const deviceWorldTransform = (
  binding: DeviceSlotSpec,
  coordinates: FloorCoordinates,
): DeviceWorldTransform => {
  const [x, z] = planPointToWorld(binding.placement.at, coordinates);
  return {
    position: [x, binding.placement.elevationMeters, z],
    rotationYRadians: binding.placement.rotationYRadians ?? 0,
    scale: binding.placement.scale ?? 1,
  };
};

const issue = (code: string, path: string, message: string): ManifestIssue => ({
  code,
  severity: "fatal",
  path,
  message,
});

const pointOnRoomBoundary = (point: readonly [number, number], room: RoomSpec) =>
  room.polygon.some((start, index) => {
    const end = room.polygon[(index + 1) % room.polygon.length];
    const lengthSquared = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
    if (lengthSquared < 1e-12) return false;
    const progress = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - start[0]) * (end[0] - start[0]) +
          (point[1] - start[1]) * (end[1] - start[1])) /
          lengthSquared,
      ),
    );
    const x = start[0] + (end[0] - start[0]) * progress;
    const y = start[1] + (end[1] - start[1]) * progress;
    return Math.hypot(point[0] - x, point[1] - y) <= 1e-7;
  });

export const validateDevicePlacementContact = ({
  binding,
  definition,
  floor,
  room,
  path,
}: {
  binding: DeviceSlotSpec;
  definition: DeviceModelDefinition;
  floor: FloorSpec;
  room: RoomSpec;
  path: string;
}): readonly ManifestIssue[] => {
  const issues: ManifestIssue[] = [];
  const placement = binding.placement;
  const scale = placement.scale ?? 1;
  if (placement.support.kind === "surface") {
    if (
      !pointInsidePolygon(placement.at, room.polygon) &&
      !pointOnRoomBoundary(placement.at, room)
    ) {
      issues.push(
        issue(
          "device.outside-room",
          `${path}.placement.at`,
          `Surface-mounted device must be placed inside room "${room.id}".`,
        ),
      );
    }
    const gap = definition.bounds.min[1] * scale;
    if (gap < SURFACE_CONTACT_MIN_METERS - 1e-8 || gap > SURFACE_CONTACT_MAX_METERS + 1e-8) {
      issues.push(
        issue(
          "device.surface-contact",
          `${path}.placement`,
          `Surface contact gap ${gap.toFixed(4)} m is outside 0–0.002 m.`,
        ),
      );
    }
    return issues;
  }

  const wallPlacement = placement as WallDevicePlacement;
  const supportWallId = wallPlacement.support.wallId;
  const wall = floor.walls.find((candidate) => candidate.id === supportWallId);
  if (!wall) {
    issues.push(
      issue(
        "device.support-wall",
        `${path}.placement.support.wallId`,
        `Wall "${supportWallId}" does not exist on this floor.`,
      ),
    );
    return issues;
  }

  const [wallStartX, wallStartZ] = planPointToWorld(wall.from, floor.coordinates);
  const [wallEndX, wallEndZ] = planPointToWorld(wall.to, floor.coordinates);
  const wallX = wallEndX - wallStartX;
  const wallZ = wallEndZ - wallStartZ;
  const wallLength = Math.hypot(wallX, wallZ);
  const directionX = wallX / wallLength;
  const directionZ = wallZ / wallLength;
  let normalX = -directionZ;
  let normalZ = directionX;
  const [roomCenterX, roomCenterZ] = planPointToWorld(
    polygonCentroid(room.polygon),
    floor.coordinates,
  );
  const wallCenterX = (wallStartX + wallEndX) / 2;
  const wallCenterZ = (wallStartZ + wallEndZ) / 2;
  if ((roomCenterX - wallCenterX) * normalX + (roomCenterZ - wallCenterZ) * normalZ < 0) {
    normalX *= -1;
    normalZ *= -1;
  }

  const [anchorX, anchorZ] = planPointToWorld(placement.at, floor.coordinates);
  const along = (anchorX - wallStartX) * directionX + (anchorZ - wallStartZ) * directionZ;
  if (along < -1e-7 || along > wallLength + 1e-7) {
    issues.push(
      issue(
        "device.wall-span",
        `${path}.placement.at`,
        `Wall-mounted device must project onto wall "${wall.id}".`,
      ),
    );
  }
  const finishX =
    wallStartX +
    directionX * Math.max(0, Math.min(wallLength, along)) +
    (normalX * wall.thicknessMeters) / 2;
  const finishZ =
    wallStartZ +
    directionZ * Math.max(0, Math.min(wallLength, along)) +
    (normalZ * wall.thicknessMeters) / 2;
  const anchorGap = (anchorX - finishX) * normalX + (anchorZ - finishZ) * normalZ;
  const visibleGap = anchorGap + definition.bounds.min[2] * scale;
  const minimum = definition.outlineContact
    ? OUTLINED_WALL_CONTACT_MIN_METERS
    : WALL_CONTACT_MIN_METERS;
  const maximum = definition.outlineContact
    ? OUTLINED_WALL_CONTACT_MAX_METERS
    : WALL_CONTACT_MAX_METERS;
  if (visibleGap < minimum - 1e-8 || visibleGap > maximum + 1e-8) {
    issues.push(
      issue(
        "device.wall-contact",
        `${path}.placement.at`,
        `Wall contact gap ${visibleGap.toFixed(4)} m is outside ${minimum.toFixed(3)}–${maximum.toFixed(3)} m.`,
      ),
    );
  }

  const frontX = Math.sin(wallPlacement.rotationYRadians);
  const frontZ = Math.cos(wallPlacement.rotationYRadians);
  const alignment = Math.max(-1, Math.min(1, frontX * normalX + frontZ * normalZ));
  if (Math.acos(alignment) > WALL_ALIGNMENT_TOLERANCE_RADIANS) {
    issues.push(
      issue(
        "device.wall-rotation",
        `${path}.placement.rotationYRadians`,
        `Wall-mounted device must face into room "${room.id}".`,
      ),
    );
  }

  const top = placement.elevationMeters + definition.bounds.max[1] * scale;
  const wallHeight = wall.heightMeters ?? floor.defaultWallHeightMeters;
  if (placement.elevationMeters < 0 || top > wallHeight + 1e-8) {
    issues.push(
      issue(
        "device.wall-height",
        `${path}.placement.elevationMeters`,
        `Wall-mounted device must fit between the floor and ${wallHeight.toFixed(3)} m.`,
      ),
    );
  }
  return issues;
};
