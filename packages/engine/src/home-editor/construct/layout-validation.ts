import { DEFAULT_WALL_COLORS } from "../../wall-colors";
import { omitUndefinedProperties } from "../../defined-properties";
import { legacyFloorHeight } from "../../building/floor-levels";
import type { LegacyHomeManifest, ManifestIssue } from "../../types";
import type { LayoutFloorSpec } from "../../home-project/types";
import { validateHomeManifest } from "../../validation";

export interface LayoutFloorValidationResult {
  valid: boolean;
  floor?: LayoutFloorSpec;
  issues: ManifestIssue[];
}

const validationEnvelope = (floor: unknown): LegacyHomeManifest => ({
  schemaVersion: 1,
  home: {
    id: "floor-layout-validation",
    name: "Floor layout validation",
    locale: "en",
    palette: {
      accent: "#c97555",
      secondary: "#718b7f",
      exterior: DEFAULT_WALL_COLORS.exterior,
      interior: DEFAULT_WALL_COLORS.interior,
      ground: "#91a06a",
    },
  },
  floors: [floor as LayoutFloorSpec],
  sceneItems: [],
  shortcuts: [],
  extensions: {
    furnishingModels: {},
    roomFurnishings: {},
    deviceModels: {},
    openingModels: {},
  },
  assumptions: [],
});

const floorPath = (path: string) =>
  path === "floors[0]"
    ? "$"
    : path.startsWith("floors[0].")
      ? path.slice("floors[0].".length)
      : path;

const layoutOnlyIssues = (input: unknown): ManifestIssue[] => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const floor = input as Record<string, unknown>;
  const issues: ManifestIssue[] = [];
  const add = (code: string, path: string, message: string) => {
    issues.push({ code, path, message, severity: "fatal" });
  };
  if (Array.isArray(floor.rooms))
    floor.rooms.forEach((room, index) => {
      if (!room || typeof room !== "object" || Array.isArray(room)) return;
      const record = room as Record<string, unknown>;
      if (record.furnishings !== undefined) {
        add(
          "layout.furnishings",
          `rooms[${index}].furnishings`,
          "Layout floors cannot contain furnishings.",
        );
      }
      if (Array.isArray(record.devices) && record.devices.length > 0) {
        add(
          "layout.devices",
          `rooms[${index}].devices`,
          "Layout floors cannot contain modeled devices.",
        );
      }
      if (Array.isArray(record.dashboardSlots) && record.dashboardSlots.length > 0) {
        add(
          "layout.dashboard-slots",
          `rooms[${index}].dashboardSlots`,
          "Layout floors cannot contain dashboard slots.",
        );
      }
    });
  if (Array.isArray(floor.openings))
    floor.openings.forEach((opening, index) => {
      if (!opening || typeof opening !== "object" || Array.isArray(opening)) return;
      const record = opening as Record<string, unknown>;
      if (record.visualModel !== undefined) {
        add(
          "layout.opening-model",
          `openings[${index}].visualModel`,
          "Layout openings must use a built-in door, window, or passage form.",
        );
      }
      if (record.contactSlot !== undefined) {
        add(
          "layout.opening-contact",
          `openings[${index}].contactSlot`,
          "Opening contacts are added after the layout stage.",
        );
      }
    });
  return issues;
};

export const validateLayoutFloorSpec = (input: unknown): LayoutFloorValidationResult => {
  const validation = validateHomeManifest(validationEnvelope(input));
  const issues = [
    ...validation.issues
      .filter((issue) => issue.path.startsWith("floors") || issue.code === "id.duplicate")
      .map((issue) => ({ ...issue, path: floorPath(issue.path) })),
    ...layoutOnlyIssues(input),
  ].sort(
    (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
  const valid = issues.length === 0;
  const candidate = input as LayoutFloorSpec;
  return omitUndefinedProperties({
    valid,
    floor: valid
      ? candidate.floorToFloorHeightMeters === undefined
        ? { ...candidate, floorToFloorHeightMeters: legacyFloorHeight(candidate) }
        : candidate
      : undefined,
    issues,
  });
};

export const assertValidLayoutFloorSpec = (input: unknown): LayoutFloorSpec => {
  const result = validateLayoutFloorSpec(input);
  if (!result.valid || !result.floor) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
  return result.floor;
};
