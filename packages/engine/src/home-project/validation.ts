import { resolveProjectModels } from "../imported-models/resolve-models";
import { validateStairs } from "../stairs/stair-validation";
import { validateTerrainExits } from "../terrain/terrain-exits";
import { validateLayoutFloorSpec } from "../home-editor/construct/layout-validation";
import type { ProjectModelRegistries } from "../types";
import { validateGlobalProjectIds } from "./cross-references";
import { validateActionBarTargets } from "./action-bar-validation";
import { validateProfileReferencesAndSlots } from "./profiles";
import { scanPureJsonValue } from "./pure-json";
import { validateHomeProjectSchemaShape } from "./schema";
import { migrateLegacyProject } from "./migrations";
import { validateSceneItemsAndSupports } from "./scene-items";
import type { HomeProject } from "./types";
import {
  addProjectIssue,
  sortProjectIssues,
  type HomeProjectIssue,
  type HomeProjectSchemaResult,
  type HomeProjectValidationResult,
} from "./validation-types";

export type {
  HomeProjectIssue,
  HomeProjectSchemaResult,
  HomeProjectValidationResult,
} from "./validation-types";

export const parseHomeProjectSchema = (input: unknown): HomeProjectSchemaResult => {
  const issues: HomeProjectIssue[] = [];
  scanPureJsonValue(input, "$", issues);
  // Shape inspection uses ordinary property reads only after descriptor scanning
  // proves that no accessor can execute.
  if (issues.length > 0) return { valid: false, issues: sortProjectIssues(issues) };
  const project = validateHomeProjectSchemaShape(input, issues);
  if (!project || issues.length > 0) {
    return { valid: false, issues: sortProjectIssues(issues) };
  }
  return {
    valid: true,
    project: project.schemaVersion === 1 ? migrateLegacyProject(project) : project,
  };
};

export const validateHomeProject = (
  input: unknown,
  registries: ProjectModelRegistries,
): HomeProjectValidationResult => {
  const schema = parseHomeProjectSchema(input);
  if (!schema.valid) return schema;
  const project: HomeProject = schema.project;
  const issues: HomeProjectIssue[] = [];
  project.floors.forEach((floor, index) => {
    if (floor.footprint.length === 0 && floor.walls.length === 0 && floor.rooms.length === 0) {
      addProjectIssue(
        issues,
        "project.floor-empty",
        `floors[${index}].footprint`,
        `Draw a closed room on “${floor.name}” before applying your changes.`,
      );
      return;
    }
    const layout = validateLayoutFloorSpec(floor);
    layout.issues.forEach((candidate) =>
      addProjectIssue(
        issues,
        candidate.code,
        candidate.path === "$" ? `floors[${index}]` : `floors[${index}].${candidate.path}`,
        candidate.message,
      ),
    );
  });
  [...validateStairs(project, registries), ...validateTerrainExits(project)].forEach((issue) =>
    issues.push({ ...issue, severity: issue.severity === "warning" ? "warning" : "error" }),
  );
  validateProfileReferencesAndSlots(project, issues);
  validateGlobalProjectIds(project, issues);
  const models = resolveProjectModels(project, registries);
  validateActionBarTargets(project, issues, models.deviceModels);
  validateSceneItemsAndSupports(project, models, issues);
  const ordered = sortProjectIssues(issues);
  return !ordered.some((issue) => issue.severity === "error")
    ? { valid: true, project, issues: ordered }
    : { valid: false, issues: ordered };
};
