import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { type DeviceDomain, type DeviceModelDefinition, type ManifestIssue } from "../types";

import {
  DOMAINS,
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isPlanPoint,
  issue,
  registerId,
  type ValidationContext,
} from "./core";

export const validateEntitySlot = (
  rawSlot: unknown,
  slotPath: string,
  context: ValidationContext,
  definition?: DeviceModelDefinition,
): readonly ManifestIssue[] => {
  if (!isObject(rawSlot)) {
    return [issue("slot.type", slotPath, "Each entity binding slot must be an object.")];
  }
  const issues = [...registerId(context, rawSlot.id, `${slotPath}.id`)];
  if (
    !Array.isArray(rawSlot.compatibleDomains) ||
    rawSlot.compatibleDomains.length === 0 ||
    !rawSlot.compatibleDomains.every((domain) => DOMAINS.has(domain as DeviceDomain))
  ) {
    issues.push(
      issue(
        "slot.domains",
        `${slotPath}.compatibleDomains`,
        "A slot requires at least one supported compatible domain.",
      ),
    );
  } else if (definition && !isAuxiliaryEntitySlot(rawSlot)) {
    rawSlot.compatibleDomains.forEach((domain, domainIndex) => {
      if (!definition.supportedDomains.includes(domain as DeviceDomain)) {
        issues.push(
          issue(
            "device.model-domain",
            `${slotPath}.compatibleDomains[${domainIndex}]`,
            `The device model does not support the ${String(domain)} domain.`,
          ),
        );
      }
    });
  }
  if (
    rawSlot.compatibleDeviceClasses !== undefined &&
    (!Array.isArray(rawSlot.compatibleDeviceClasses) ||
      !rawSlot.compatibleDeviceClasses.every(isNonEmptyString))
  ) {
    issues.push(
      issue(
        "slot.device-classes",
        `${slotPath}.compatibleDeviceClasses`,
        "Compatible device classes must be non-empty strings.",
      ),
    );
  }
  if (rawSlot.sceneLight !== undefined) {
    const light = rawSlot.sceneLight;
    if (!isObject(light)) {
      issues.push(
        issue(
          "slot.scene-light",
          `${slotPath}.sceneLight`,
          "A scene light must be an object when supplied.",
        ),
      );
    } else if (
      !Array.isArray(rawSlot.compatibleDomains) ||
      !rawSlot.compatibleDomains.includes("light") ||
      !isPlanPoint(light.at) ||
      !isFiniteNumber(light.elevationMeters) ||
      !isNonEmptyString(light.color) ||
      !isFiniteNumber(light.maxIntensity) ||
      light.maxIntensity <= 0 ||
      !isFiniteNumber(light.distance) ||
      light.distance <= 0
    ) {
      issues.push(
        issue(
          "slot.scene-light",
          `${slotPath}.sceneLight`,
          "A scene light requires a light-compatible slot, plan position, finite elevation, CSS color, and positive intensity and distance.",
        ),
      );
    }
  }
  if (typeof rawSlot.required !== "boolean") {
    issues.push(
      issue("slot.required", `${slotPath}.required`, "A slot must declare whether it is required."),
    );
  }
  if (!["unique-compatible", "manual"].includes(String(rawSlot.autoMap))) {
    issues.push(
      issue(
        "slot.auto-map",
        `${slotPath}.autoMap`,
        "Slot autoMap must be unique-compatible or manual.",
      ),
    );
  }
  if (
    rawSlot.deviceRole !== undefined &&
    !["primary", "secondary"].includes(
      typeof rawSlot.deviceRole === "string" ? rawSlot.deviceRole : "",
    )
  ) {
    issues.push(
      issue(
        "slot.device-role",
        `${slotPath}.deviceRole`,
        "Device role must be primary or secondary.",
      ),
    );
  }
  if (!isObject(rawSlot.presentation)) {
    issues.push(
      issue("slot.presentation", `${slotPath}.presentation`, "A slot presentation is required."),
    );
  } else {
    if (
      rawSlot.presentation.showInScene !== undefined &&
      typeof rawSlot.presentation.showInScene !== "boolean" &&
      rawSlot.presentation.showInScene !== "if-present"
    ) {
      issues.push(
        issue(
          "slot.map-visibility",
          `${slotPath}.presentation.showInScene`,
          "Map visibility must be boolean or if-present.",
        ),
      );
    }
    if (!isNonEmptyString(rawSlot.presentation.label)) {
      issues.push(
        issue("slot.label", `${slotPath}.presentation.label`, "A slot label is required."),
      );
    }
    if (
      !["primary", "secondary", "diagnostic", "hidden"].includes(
        String(rawSlot.presentation.dashboardRole),
      )
    ) {
      issues.push(
        issue(
          "slot.dashboard-role",
          `${slotPath}.presentation.dashboardRole`,
          "Dashboard role is invalid.",
        ),
      );
    }
  }
  return issues;
};
