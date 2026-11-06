import { validateSlopedCeilingPlanes } from "../validation/ceiling-rules";
import { array, finite, keys, record, string } from "./schema-json-values";
import { addProjectIssue, isPlainRecord, type HomeProjectIssue } from "./validation-types";

export const ceilingSchema = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const ceiling = record(value, path, issues);
  if (!ceiling) return;
  string(ceiling.id, `${path}.id`, issues);
  const roomIds = array(ceiling.roomIds, `${path}.roomIds`, issues);
  roomIds?.forEach((id, index) => string(id, `${path}.roomIds[${index}]`, issues));
  if (ceiling.kind === "sloped") {
    keys(ceiling, ["id", "kind", "roomIds", "planes"], path, issues);
    if (roomIds?.length === 0)
      addProjectIssue(
        issues,
        "ceiling.rooms",
        `${path}.roomIds`,
        "A sloped ceiling needs at least one room.",
      );
    if (Array.isArray(ceiling.planes)) {
      ceiling.planes.forEach((plane, index) => {
        if (isPlainRecord(plane)) {
          keys(
            plane,
            ["id", "boundary", "lowEdge", "highEdge", "lowHeightMeters", "highHeightMeters"],
            `${path}.planes[${index}]`,
            issues,
          );
        }
      });
    }
    for (const issue of validateSlopedCeilingPlanes(ceiling.planes, `${path}.planes`)) {
      addProjectIssue(issues, issue.code, issue.path, issue.message);
    }
    return;
  }
  keys(ceiling, ["id", "kind", "roomIds", "heightMeters"], path, issues);
  finite(ceiling.heightMeters, `${path}.heightMeters`, issues);
  if (ceiling.kind !== "flat") {
    addProjectIssue(
      issues,
      "project.ceiling-kind",
      `${path}.kind`,
      "Ceiling kind must be flat or sloped.",
    );
  }
};
