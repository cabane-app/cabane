import type { BuiltInShortcutId, ManifestIssue } from "../types";
import {
  combineRules,
  isDeviceModelDefinition,
  isFurnishingModelDefinition,
  isNonEmptyString,
  isFiniteNumber,
  isPlanPoint,
  isObject,
  issue,
  registerId,
  type RawObject,
  type ValidationRule,
} from "./core";
import { validateFloors } from "./floor-rules";
import { isTerrainSettings } from "../terrain/terrain-settings";

const SHORTCUTS = new Set<BuiltInShortcutId>([
  "home-view",
  "room-details",
  "construct-mode",
  "arrange-mode",
  "connect-mode",
  "walk-mode",
  "lighting-mode",
  "wall-fade",
  "all-lights",
]);

const validateHeader: ValidationRule<RawObject> = (input) => {
  const issues: ManifestIssue[] = [];
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) {
    issues.push(
      issue("manifest.schema-version", "schemaVersion", "Supported manifest versions are 1 and 2."),
    );
  }
  if (!isObject(input.home)) {
    issues.push(issue("home.type", "home", "Home metadata must be an object."));
  } else {
    if (input.home.terrain !== undefined && !isTerrainSettings(input.home.terrain))
      issues.push(
        issue(
          "home.terrain",
          "home.terrain",
          "Terrain requires four finite corner heights between −100 and 100 metres.",
        ),
      );
    for (const key of ["id", "name"] as const) {
      if (!isNonEmptyString(input.home[key])) {
        issues.push(issue(`home.${key}`, `home.${key}`, `Home ${key} must be a non-empty string.`));
      }
    }
    if (input.home.locale !== "en") {
      issues.push(issue("home.locale", "home.locale", 'V1 supports only the "en" locale.'));
    }
    if (!isObject(input.home.palette)) {
      issues.push(issue("home.palette", "home.palette", "The home palette must be an object."));
    } else {
      for (const color of ["accent", "secondary", "exterior", "interior", "ground"] as const) {
        if (!isNonEmptyString(input.home.palette[color])) {
          issues.push(
            issue(
              "home.palette.color",
              `home.palette.${color}`,
              `${color} must be a non-empty CSS color.`,
            ),
          );
        }
      }
    }
  }

  if (!Array.isArray(input.floors)) {
    issues.push(issue("floors.type", "floors", "Floors must be an array containing one floor."));
  } else if (input.schemaVersion === 1 ? input.floors.length !== 1 : input.floors.length === 0) {
    issues.push(
      issue(
        "floors.count",
        "floors",
        "A building requires at least one floor; legacy manifests require exactly one.",
      ),
    );
  }
  if (input.schemaVersion === 2) {
    const coordinates = input.coordinates;
    if (
      !isObject(coordinates) ||
      !isPlanPoint(coordinates.origin) ||
      !isFiniteNumber(coordinates.metersPerPlanUnit) ||
      coordinates.metersPerPlanUnit <= 0 ||
      !["measured", "inferred"].includes(String(coordinates.scaleBasis))
    ) {
      issues.push(
        issue(
          "building.coordinates",
          "coordinates",
          "A building requires a valid shared plan transform.",
        ),
      );
    }
    if (!Array.isArray(input.stairs))
      issues.push(issue("building.stairs", "stairs", "Stairs must be an array."));
    let groundSeen = false;
    if (Array.isArray(input.floors))
      input.floors.forEach((floor, index) => {
        if (!isObject(floor)) return;
        if (floor.belowGround !== undefined && typeof floor.belowGround !== "boolean")
          issues.push(
            issue(
              "floor.basement",
              `floors[${index}].belowGround`,
              "Basement classification must be a boolean.",
            ),
          );
        if (floor.belowGround === true && groundSeen)
          issues.push(
            issue(
              "floor.order",
              `floors[${index}].belowGround`,
              "Basements must precede the ground floor.",
            ),
          );
        if (floor.belowGround !== true) groundSeen = true;
        if (!isFiniteNumber(floor.floorToFloorHeightMeters) || floor.floorToFloorHeightMeters <= 0)
          issues.push(
            issue(
              "floor.level-height",
              `floors[${index}].floorToFloorHeightMeters`,
              "Floor height must be positive finite metres.",
            ),
          );
        const transform = floor.coordinates;
        if (
          isObject(coordinates) &&
          isObject(transform) &&
          (JSON.stringify(coordinates.origin) !== JSON.stringify(transform.origin) ||
            coordinates.metersPerPlanUnit !== transform.metersPerPlanUnit ||
            coordinates.scaleBasis !== transform.scaleBasis)
        )
          issues.push(
            issue(
              "floor.transform",
              `floors[${index}].coordinates`,
              "All floors must use the building coordinates.",
            ),
          );
      });
    if (
      Array.isArray(input.floors) &&
      input.floors.length &&
      !groundSeen &&
      !input.floors.every((floor) => isObject(floor) && isFiniteNumber(floor.elevationMeters))
    )
      issues.push(issue("floor.ground-missing", "floors", "A building requires a ground floor."));
  }
  return issues;
};

const validateShortcuts: ValidationRule<RawObject> = (input, context) => {
  if (!Array.isArray(input.shortcuts)) {
    return [issue("shortcuts.type", "shortcuts", "Shortcuts must be an array.")];
  }
  const issues: ManifestIssue[] = [];
  const orders = new Set<number>();
  input.shortcuts.forEach((rawShortcut, index) => {
    const path = `shortcuts[${index}]`;
    if (!isObject(rawShortcut)) {
      issues.push(issue("shortcut.type", path, "Each shortcut must be an object."));
      return;
    }
    issues.push(...registerId(context, rawShortcut.id, `${path}.id`));
    if (!SHORTCUTS.has(rawShortcut.action as BuiltInShortcutId)) {
      issues.push(
        issue(
          "shortcut.action",
          `${path}.action`,
          "Shortcut action is not a safe built-in action.",
        ),
      );
    }
    if (!["overview", "room", "both"].includes(String(rawShortcut.context))) {
      issues.push(issue("shortcut.context", `${path}.context`, "Shortcut context is invalid."));
    }
    if (!Number.isInteger(rawShortcut.order)) {
      issues.push(issue("shortcut.order", `${path}.order`, "Shortcut order must be an integer."));
    } else if (orders.has(rawShortcut.order as number)) {
      issues.push(
        issue("shortcut.order-duplicate", `${path}.order`, "Shortcut order must be unique."),
      );
    } else {
      orders.add(rawShortcut.order as number);
    }
  });
  return issues;
};

const validateExtensions: ValidationRule<RawObject> = (input) => {
  if (!isObject(input.extensions)) {
    return [issue("extensions.type", "extensions", "An extension registry is required.")];
  }
  const issues: ManifestIssue[] = [];
  for (const key of ["furnishingModels", "deviceModels", "openingModels"] as const) {
    if (!isObject(input.extensions[key])) {
      issues.push(
        issue("extensions.registry", `extensions.${key}`, `${key} must be an object registry.`),
      );
      continue;
    }
    for (const [extensionKey, component] of Object.entries(input.extensions[key])) {
      const validEntry =
        key === "deviceModels"
          ? isDeviceModelDefinition(component)
          : key === "furnishingModels"
            ? isFurnishingModelDefinition(component)
            : typeof component === "function";
      if (!isNonEmptyString(extensionKey) || !validEntry) {
        issues.push(
          issue(
            "extensions.entry",
            `extensions.${key}.${extensionKey}`,
            key === "openingModels"
              ? "Opening extensions must be React components keyed by non-empty strings."
              : "Scene model extensions must be typed definitions keyed by non-empty strings.",
          ),
        );
      }
    }
  }
  if (input.extensions.roomFurnishings !== undefined) {
    if (!isObject(input.extensions.roomFurnishings)) {
      issues.push(
        issue(
          "extensions.registry",
          "extensions.roomFurnishings",
          "roomFurnishings must be an object registry when supplied.",
        ),
      );
    } else {
      for (const [extensionKey, component] of Object.entries(input.extensions.roomFurnishings)) {
        if (!isNonEmptyString(extensionKey) || typeof component !== "function") {
          issues.push(
            issue(
              "extensions.entry",
              `extensions.roomFurnishings.${extensionKey}`,
              "Legacy furnishing entries must be React components keyed by non-empty strings.",
            ),
          );
        }
      }
    }
  }
  return issues;
};

const validateSceneItems: ValidationRule<RawObject> = (input, context) => {
  if (!Array.isArray(input.sceneItems)) {
    return [issue("scene-items.type", "sceneItems", "Scene items must be an array.")];
  }
  const issues: ManifestIssue[] = [];
  input.sceneItems.forEach((candidate, index) => {
    const path = `sceneItems[${index}]`;
    if (!isObject(candidate)) {
      issues.push(issue("scene-item.type", path, "Each scene item must be an object."));
      return;
    }
    if (!["furnishing", "device"].includes(String(candidate.kind))) {
      issues.push(
        issue("scene-item.kind", `${path}.kind`, "Scene item kind must be furnishing or device."),
      );
    }
    if (
      input.schemaVersion === 2 &&
      (!isNonEmptyString(candidate.floorId) ||
        !Array.isArray(input.floors) ||
        !input.floors.some((floor) => isObject(floor) && floor.id === candidate.floorId))
    ) {
      issues.push(
        issue(
          "scene-item.floor",
          `${path}.floorId`,
          "Scene items must belong to an existing floor.",
        ),
      );
    }
    if (!isNonEmptyString(candidate.id)) {
      issues.push(
        issue("scene-item.id", `${path}.id`, "Scene item id must be a non-empty string."),
      );
    } else {
      const composedDeviceAlias =
        candidate.kind === "device" &&
        Array.isArray(input.floors) &&
        input.floors.some(
          (floor) =>
            isObject(floor) &&
            Array.isArray(floor.rooms) &&
            floor.rooms.some(
              (room) =>
                isObject(room) &&
                Array.isArray(room.devices) &&
                room.devices.some(
                  (device) =>
                    isObject(device) &&
                    device.id === candidate.id &&
                    device.model === candidate.modelId &&
                    Array.isArray(device.entitySlots) &&
                    Array.isArray(candidate.entitySlots) &&
                    device.entitySlots
                      .map((slot) => (isObject(slot) ? slot.id : undefined))
                      .join("\u0000") ===
                      candidate.entitySlots
                        .map((slot) => (isObject(slot) ? slot.id : undefined))
                        .join("\u0000"),
                ),
            ),
        );
      if (!composedDeviceAlias) {
        issues.push(...registerId(context, candidate.id, `${path}.id`));
      }
    }
    if (!isNonEmptyString(candidate.modelId)) {
      issues.push(
        issue(
          "scene-item.model",
          `${path}.modelId`,
          "Scene item modelId must be a non-empty string.",
        ),
      );
    }
  });
  return issues;
};

const validateAssumptions: ValidationRule<RawObject> = (input) =>
  Array.isArray(input.assumptions)
    ? []
    : [issue("assumptions.type", "assumptions", "Assumptions must be an array.")];

export const validateManifestRules = combineRules(
  validateHeader,
  validateFloors,
  validateShortcuts,
  validateExtensions,
  validateSceneItems,
  validateAssumptions,
);
