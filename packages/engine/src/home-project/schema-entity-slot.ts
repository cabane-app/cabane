import { keys, record, array, string, finite, point } from "./schema-json-values";
import type { DeviceDomain } from "../types";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";
const DEVICE_DOMAINS = new Set<DeviceDomain>([
  "light",
  "switch",
  "input_boolean",
  "climate",
  "cover",
  "fan",
  "media_player",
  "humidifier",
  "water_heater",
  "vacuum",
  "lock",
  "alarm_control_panel",
  "valve",
  "siren",
  "select",
  "number",
  "button",
  "camera",
  "sensor",
  "binary_sensor",
  "event",
]);
const stringArray = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  array(value, path, issues)?.forEach((entry, index) => string(entry, `${path}[${index}]`, issues));
};
export const entitySlot = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const slot = record(value, path, issues);
  if (!slot) return;
  keys(
    slot,
    [
      "id",
      "compatibleDomains",
      "compatibleDeviceClasses",
      "required",
      "autoMap",
      "deviceRole",
      "presentation",
      "sceneLight",
    ],
    path,
    issues,
  );
  string(slot.id, `${path}.id`, issues);
  array(slot.compatibleDomains, `${path}.compatibleDomains`, issues)?.forEach((domain, index) => {
    if (!DEVICE_DOMAINS.has(domain as DeviceDomain)) {
      addProjectIssue(
        issues,
        "project.slot-domain",
        `${path}.compatibleDomains[${index}]`,
        "Entity slot domain is not supported.",
      );
    }
  });
  if (slot.compatibleDeviceClasses !== undefined) {
    stringArray(slot.compatibleDeviceClasses, `${path}.compatibleDeviceClasses`, issues);
  }
  if (typeof slot.required !== "boolean") {
    addProjectIssue(
      issues,
      "project.boolean",
      `${path}.required`,
      "Slot required must be boolean.",
    );
  }
  if (!["unique-compatible", "manual"].includes(String(slot.autoMap))) {
    addProjectIssue(issues, "project.slot-auto-map", `${path}.autoMap`, "Slot autoMap is invalid.");
  }
  if (
    slot.deviceRole !== undefined &&
    !["primary", "secondary"].includes(typeof slot.deviceRole === "string" ? slot.deviceRole : "")
  ) {
    addProjectIssue(
      issues,
      "project.slot-role",
      `${path}.deviceRole`,
      "Slot deviceRole is invalid.",
    );
  }
  const presentation = record(slot.presentation, `${path}.presentation`, issues);
  if (presentation) {
    keys(presentation, ["label", "dashboardRole"], `${path}.presentation`, issues);
    string(presentation.label, `${path}.presentation.label`, issues);
    if (
      !["primary", "secondary", "diagnostic", "hidden"].includes(String(presentation.dashboardRole))
    ) {
      addProjectIssue(
        issues,
        "project.slot-dashboard-role",
        `${path}.presentation.dashboardRole`,
        "Slot dashboardRole is invalid.",
      );
    }
  }
  if (slot.sceneLight !== undefined) {
    const light = record(slot.sceneLight, `${path}.sceneLight`, issues);
    if (light) {
      keys(
        light,
        ["at", "elevationMeters", "color", "maxIntensity", "distance"],
        `${path}.sceneLight`,
        issues,
      );
      point(light.at, `${path}.sceneLight.at`, issues);
      finite(light.elevationMeters, `${path}.sceneLight.elevationMeters`, issues);
      string(light.color, `${path}.sceneLight.color`, issues);
      finite(light.maxIntensity, `${path}.sceneLight.maxIntensity`, issues);
      finite(light.distance, `${path}.sceneLight.distance`, issues);
    }
  }
};
