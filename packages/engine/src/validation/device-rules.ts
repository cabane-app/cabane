import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { validateDevicePlacementContact } from "../devices";

import { type FloorSpec, type HomeManifest, type ManifestIssue } from "../types";

import {
  STABLE_MODELS,
  extensionDefinition,
  extensionHas,
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isPlanPoint,
  isPolygon,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

import { validateEntitySlot } from "./entity-slot-rules";

export const validateDevice = (
  rawDevice: unknown,
  devicePath: string,
  rawRoom: RawObject,
  rawFloor: RawObject,
  context: ValidationContext,
): readonly ManifestIssue[] => {
  if (!isObject(rawDevice)) {
    return [issue("device.type", devicePath, "Each device slot must be an object.")];
  }
  const issues = [...registerId(context, rawDevice.id, `${devicePath}.id`)];
  const modelIsExtension = isNonEmptyString(rawDevice.model) && !STABLE_MODELS.has(rawDevice.model);
  if (!isNonEmptyString(rawDevice.model)) {
    issues.push(
      issue(
        "device.model",
        `${devicePath}.model`,
        "A stable model ID or extension key is required.",
      ),
    );
  }
  if (modelIsExtension && !extensionHas(context.input, "deviceModels", rawDevice.model as string)) {
    issues.push(
      issue(
        "device.model-extension",
        `${devicePath}.model`,
        `Model “${String(rawDevice.model)}” is unavailable. A placeholder will be shown.`,
        "warning",
      ),
    );
  }
  const definition = isNonEmptyString(rawDevice.model)
    ? modelIsExtension
      ? extensionDefinition(context.input, rawDevice.model)
      : context.options.deviceModels && Object.hasOwn(context.options.deviceModels, rawDevice.model)
        ? context.options.deviceModels[rawDevice.model]
        : undefined
    : undefined;
  if (!modelIsExtension && isNonEmptyString(rawDevice.model) && !definition) {
    issues.push(
      issue(
        "device.model-registry",
        `${devicePath}.model`,
        `Model “${rawDevice.model}” is unavailable. A placeholder will be shown.`,
        "warning",
      ),
    );
  }
  if (!Array.isArray(rawDevice.entitySlots) || rawDevice.entitySlots.length === 0) {
    issues.push(
      issue(
        "device.entity-slots",
        `${devicePath}.entitySlots`,
        "A modeled device requires at least one typed entity slot.",
      ),
    );
  } else {
    rawDevice.entitySlots.forEach((rawSlot, slotIndex) => {
      issues.push(
        ...validateEntitySlot(
          rawSlot,
          `${devicePath}.entitySlots[${slotIndex}]`,
          context,
          definition,
        ),
      );
    });
    const primaryCount = rawDevice.entitySlots.filter(
      (rawSlot) => isObject(rawSlot) && rawSlot.deviceRole === "primary",
    ).length;
    if (primaryCount !== 1) {
      issues.push(
        issue(
          "device.primary-slot",
          `${devicePath}.entitySlots`,
          "A modeled device requires exactly one primary entity slot.",
        ),
      );
    }
    if (
      definition?.liveMedia?.kind === "camera-stream" &&
      (!definition.supportedDomains.includes("media_player") ||
        rawDevice.entitySlots.some(
          (slot) =>
            isObject(slot) &&
            Array.isArray(slot.compatibleDomains) &&
            slot.compatibleDomains.includes("camera"),
        ))
    ) {
      const controlSlots = rawDevice.entitySlots.filter(
        (slot) => !isObject(slot) || !isAuxiliaryEntitySlot(slot),
      );
      const cameraSlot: unknown = controlSlots[0];
      if (
        controlSlots.length !== 1 ||
        !isObject(cameraSlot) ||
        cameraSlot.deviceRole !== definition.liveMedia.slotRole ||
        cameraSlot.required !== true ||
        !Array.isArray(cameraSlot.compatibleDomains) ||
        cameraSlot.compatibleDomains.length === 0 ||
        cameraSlot.compatibleDomains.some(
          (domain) =>
            domain !== "camera" &&
            !(
              ["media_player", "switch"].includes(String(domain)) &&
              definition.supportedDomains.includes(domain as import("../types").DeviceDomain)
            ),
        )
      ) {
        issues.push(
          issue(
            "device.camera-stream-slot",
            `${devicePath}.entitySlots`,
            "A camera-stream device requires one required primary slot using camera or a supported media-player alternative.",
          ),
        );
      }
    }
  }
  if (!isObject(rawDevice.placement)) {
    issues.push(
      issue("device.placement", `${devicePath}.placement`, "Device placement must be an object."),
    );
    return issues;
  }

  const validPoint = isPlanPoint(rawDevice.placement.at);
  const elevationMeters = rawDevice.placement.elevationMeters;
  const validElevation = isFiniteNumber(elevationMeters);
  if (!validPoint) {
    issues.push(
      issue(
        "device.placement",
        `${devicePath}.placement.at`,
        "Device placement requires a finite plan point.",
      ),
    );
  }
  if (!validElevation) {
    issues.push(
      issue(
        "device.placement",
        `${devicePath}.placement.elevationMeters`,
        "Device elevation must be finite.",
      ),
    );
  } else if (elevationMeters < 0) {
    issues.push(
      issue(
        "device.elevation",
        `${devicePath}.placement.elevationMeters`,
        "Device elevation cannot be negative.",
        "warning",
      ),
    );
  }
  if (
    rawDevice.placement.rotationYRadians !== undefined &&
    !isFiniteNumber(rawDevice.placement.rotationYRadians)
  ) {
    issues.push(
      issue(
        "device.rotation",
        `${devicePath}.placement.rotationYRadians`,
        "Device rotation must be finite when provided.",
      ),
    );
  }
  if (
    rawDevice.placement.scale !== undefined &&
    (!isFiniteNumber(rawDevice.placement.scale) || rawDevice.placement.scale <= 0)
  ) {
    issues.push(
      issue(
        "device.scale",
        `${devicePath}.placement.scale`,
        "Device scale must be greater than zero when provided.",
      ),
    );
  }
  if (
    !isObject(rawDevice.placement.support) ||
    !["surface", "wall"].includes(String(rawDevice.placement.support.kind))
  ) {
    issues.push(
      issue(
        "device.support",
        `${devicePath}.placement.support`,
        "Device support must be surface or wall.",
      ),
    );
  } else if (rawDevice.placement.support.kind === "wall") {
    if (!isNonEmptyString(rawDevice.placement.support.wallId)) {
      issues.push(
        issue(
          "device.support-wall",
          `${devicePath}.placement.support.wallId`,
          "Wall support requires an exact wall ID.",
        ),
      );
    }
    if (!isFiniteNumber(rawDevice.placement.rotationYRadians)) {
      issues.push(
        issue(
          "device.wall-rotation",
          `${devicePath}.placement.rotationYRadians`,
          "Wall support requires a finite inward-facing rotation.",
        ),
      );
    }
  }

  const composedSceneItem =
    Array.isArray(context.input.sceneItems) &&
    context.input.sceneItems.some(
      (candidate) =>
        isObject(candidate) &&
        candidate.kind === "device" &&
        candidate.id === rawDevice.id &&
        candidate.modelId === rawDevice.model,
    );
  if (
    !composedSceneItem &&
    definition &&
    isObject(rawDevice.placement.support) &&
    ["surface", "wall"].includes(String(rawDevice.placement.support.kind)) &&
    (rawDevice.placement.support.kind !== "wall" ||
      isFiniteNumber(rawDevice.placement.rotationYRadians)) &&
    validPoint &&
    validElevation &&
    (rawDevice.placement.scale === undefined ||
      (isFiniteNumber(rawDevice.placement.scale) && rawDevice.placement.scale > 0)) &&
    isPolygon(rawRoom.polygon) &&
    isObject(rawFloor.coordinates) &&
    isPlanPoint(rawFloor.coordinates.origin) &&
    isFiniteNumber(rawFloor.coordinates.metersPerPlanUnit) &&
    Array.isArray(rawFloor.walls)
  ) {
    issues.push(
      ...validateDevicePlacementContact({
        binding:
          rawDevice as unknown as HomeManifest["floors"][number]["rooms"][number]["devices"][number],
        definition,
        floor: rawFloor as unknown as FloorSpec,
        room: rawRoom as unknown as HomeManifest["floors"][number]["rooms"][number],
        path: devicePath,
      }),
    );
  }
  return issues;
};
