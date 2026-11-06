import {
  addProjectIssue,
  isPlainRecord,
  type HomeProjectIssue,
  type JsonRecord,
} from "./validation-types";
import { unsupportedProjectFormatMessage } from "./project-format-errors";

export const keys = (
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
  issues: HomeProjectIssue[],
) => {
  const accepted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) {
      addProjectIssue(
        issues,
        "project.unknown-key",
        path === "$" ? key : `${path}.${key}`,
        unsupportedProjectFormatMessage(`Property “${key}” is not part of the HomeProject schema.`),
      );
    }
  }
};

export const record = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  if (isPlainRecord(value)) return value;
  addProjectIssue(issues, "project.object", path, "Expected a plain JSON object.");
  return null;
};

export const array = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  if (Array.isArray(value)) return value as unknown[];
  addProjectIssue(issues, "project.array", path, "Expected an array.");
  return null;
};

export const string = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  if (typeof value === "string" && value.trim().length > 0) return;
  addProjectIssue(issues, "project.string", path, "Expected a non-empty string.");
};

export const stringArray = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  array(value, path, issues)?.forEach((entry, index) => string(entry, `${path}[${index}]`, issues));
};

export const finite = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  if (typeof value === "number" && Number.isFinite(value)) return;
  addProjectIssue(issues, "project.number", path, "Expected a finite number.");
};

export const point = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = array(value, path, issues);
  if (!candidate) return;
  if (candidate.length !== 2) {
    addProjectIssue(
      issues,
      "project.plan-point",
      path,
      "A plan point requires exactly two numbers.",
    );
    return;
  }
  candidate.forEach((entry, index) => finite(entry, `${path}[${index}]`, issues));
};

export const polygon = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = array(value, path, issues);
  if (!candidate) return;
  if (candidate.length < 3) {
    addProjectIssue(issues, "project.polygon", path, "A polygon requires at least three points.");
  }
  candidate.forEach((entry, index) => point(entry, `${path}[${index}]`, issues));
};
