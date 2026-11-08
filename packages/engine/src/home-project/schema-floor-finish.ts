import { keys, record, string, polygon } from "./schema-json-values";
import { FLOOR_PATTERN_PRESET_IDS } from "../types";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

const FLOOR_PRESETS = new Set<string>(FLOOR_PATTERN_PRESET_IDS);

export const floorFinish = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  if (candidate.kind === "grass") {
    keys(candidate, ["kind"], path, issues);
    return;
  }
  if (candidate.kind === "solid") {
    keys(candidate, ["kind", "color"], path, issues);
    string(candidate.color, `${path}.color`, issues);
    return;
  }
  if (candidate.kind === "preset") {
    keys(candidate, ["kind", "preset", "color"], path, issues);
    if (
      candidate.color !== undefined &&
      (typeof candidate.color !== "string" || !/^#[0-9a-f]{6}$/i.test(candidate.color))
    ) {
      addProjectIssue(
        issues,
        "project.floor-color",
        `${path}.color`,
        "Tile color must be a six-digit hex color.",
      );
    }
    if (!FLOOR_PRESETS.has(String(candidate.preset))) {
      addProjectIssue(
        issues,
        "project.floor-preset",
        `${path}.preset`,
        "Floor preset is not supported.",
      );
    }
    return;
  }
  keys(candidate, ["kind"], path, issues);
  addProjectIssue(
    issues,
    "project.floor-finish-kind",
    `${path}.kind`,
    "Floor finish kind must be solid, preset, or grass.",
  );
};

export const floorZone = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  keys(candidate, ["id", "polygon", "finish"], path, issues);
  string(candidate.id, `${path}.id`, issues);
  polygon(candidate.polygon, `${path}.polygon`, issues);
  floorFinish(candidate.finish, `${path}.finish`, issues);
};
