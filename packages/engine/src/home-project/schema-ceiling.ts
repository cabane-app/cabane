import {
  record,
  keys,
  array,
  string,
  stringArray,
  finite,
  point,
  polygon,
} from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

/** A flat ceiling, or a sloped one made of planes that rise from a low edge to a high edge. */
export const ceilingSchema = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const ceiling = record(value, path, issues);
  if (!ceiling) return;
  string(ceiling.id, `${path}.id`, issues);
  stringArray(ceiling.roomIds, `${path}.roomIds`, issues);
  if (ceiling.kind === "flat") {
    keys(ceiling, ["id", "kind", "roomIds", "heightMeters"], path, issues);
    finite(ceiling.heightMeters, `${path}.heightMeters`, issues);
  } else if (ceiling.kind === "sloped") {
    keys(ceiling, ["id", "kind", "roomIds", "planes"], path, issues);
    array(ceiling.planes, `${path}.planes`, issues)?.forEach((entry, planeIndex) => {
      const planePath = `${path}.planes[${planeIndex}]`;
      const plane = record(entry, planePath, issues);
      if (!plane) return;
      keys(
        plane,
        ["id", "boundary", "lowEdge", "highEdge", "lowHeightMeters", "highHeightMeters"],
        planePath,
        issues,
      );
      string(plane.id, `${planePath}.id`, issues);
      polygon(plane.boundary, `${planePath}.boundary`, issues);
      for (const edge of ["lowEdge", "highEdge"] as const) {
        const points = array(plane[edge], `${planePath}.${edge}`, issues);
        if (points && points.length !== 2)
          addProjectIssue(
            issues,
            "project.ceiling-plane-edge",
            `${planePath}.${edge}`,
            "A ceiling plane edge has two points.",
          );
        points?.forEach((value, index) => point(value, `${planePath}.${edge}[${index}]`, issues));
      }
      finite(plane.lowHeightMeters, `${planePath}.lowHeightMeters`, issues);
      finite(plane.highHeightMeters, `${planePath}.highHeightMeters`, issues);
    });
  } else
    addProjectIssue(
      issues,
      "project.ceiling-kind",
      `${path}.kind`,
      "Ceiling kind must be flat or sloped.",
    );
};
