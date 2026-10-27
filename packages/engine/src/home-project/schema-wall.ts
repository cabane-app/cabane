import { WALL_SURFACE_PATTERNS } from "../types";
import { record, keys, string, finite, point } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";
import { wallNichesSchema } from "./schema-wall-niches";

export const wallSchema = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  keys(
    candidate,
    [
      "id",
      "from",
      "to",
      "classification",
      "thicknessMeters",
      "heightMeters",
      "exteriorColor",
      "edgeColor",
      "faceColors",
      "faceFinishes",
      "niches",
    ],
    path,
    issues,
  );
  string(candidate.id, `${path}.id`, issues);
  point(candidate.from, `${path}.from`, issues);
  point(candidate.to, `${path}.to`, issues);
  if (!["interior", "exterior"].includes(String(candidate.classification))) {
    addProjectIssue(
      issues,
      "project.wall-classification",
      `${path}.classification`,
      "Wall classification is invalid.",
    );
  }
  finite(candidate.thicknessMeters, `${path}.thicknessMeters`, issues);
  wallNichesSchema(candidate.niches, `${path}.niches`, issues);
  if (candidate.heightMeters !== undefined)
    finite(candidate.heightMeters, `${path}.heightMeters`, issues);
  if (candidate.exteriorColor !== undefined)
    string(candidate.exteriorColor, `${path}.exteriorColor`, issues);
  if (candidate.edgeColor !== undefined) string(candidate.edgeColor, `${path}.edgeColor`, issues);
  if (candidate.faceFinishes !== undefined) {
    const finishes = record(candidate.faceFinishes, `${path}.faceFinishes`, issues);
    if (finishes) {
      keys(finishes, ["left", "right"], `${path}.faceFinishes`, issues);
      for (const side of ["left", "right"] as const) {
        if (finishes[side] === undefined) continue;
        const at = `${path}.faceFinishes.${side}`;
        const finish = record(finishes[side], at, issues);
        if (!finish) continue;
        keys(finish, ["pattern", "color", "repeatMeters"], at, issues);
        if (
          !WALL_SURFACE_PATTERNS.includes(finish.pattern as (typeof WALL_SURFACE_PATTERNS)[number])
        )
          addProjectIssue(
            issues,
            "project.wall-pattern",
            `${at}.pattern`,
            "Wall pattern is not supported.",
          );
        if (typeof finish.color !== "string" || !/^#[0-9a-f]{6}$/i.test(finish.color))
          addProjectIssue(
            issues,
            "project.wall-pattern-color",
            `${at}.color`,
            "Pattern color must be a six-digit hex color.",
          );
        if (
          typeof finish.repeatMeters !== "number" ||
          !Number.isFinite(finish.repeatMeters) ||
          finish.repeatMeters < 0.1 ||
          finish.repeatMeters > 5
        )
          addProjectIssue(
            issues,
            "project.wall-pattern-scale",
            `${at}.repeatMeters`,
            "Pattern repeat must be between 0.1 and 5 meters.",
          );
      }
    }
  }
  if (candidate.faceColors !== undefined) {
    const colors = record(candidate.faceColors, `${path}.faceColors`, issues);
    if (colors) {
      keys(colors, ["left", "right"], `${path}.faceColors`, issues);
      if (colors.left !== undefined) string(colors.left, `${path}.faceColors.left`, issues);
      if (colors.right !== undefined) string(colors.right, `${path}.faceColors.right`, issues);
    }
  }
};
