import { array, finite, keys, record, string } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

export function elevationSettings(value: unknown, path: string, issues: HomeProjectIssue[]) {
  const settings = record(value, path, issues);
  if (!settings) return;
  keys(settings, ["offsetMeters", "ceilingHeightMeters", "edges"], path, issues);
  finite(settings.offsetMeters, `${path}.offsetMeters`, issues);
  if (settings.ceilingHeightMeters !== undefined) {
    finite(settings.ceilingHeightMeters, `${path}.ceilingHeightMeters`, issues);
    if (typeof settings.ceilingHeightMeters === "number" && settings.ceilingHeightMeters <= 0)
      addProjectIssue(issues, "elevation.ceiling", path, "Ceiling height must be positive.");
  }
  const ids = new Set<string>();
  array(settings.edges, `${path}.edges`, issues)?.forEach((value, index) => {
    const p = `${path}.edges[${index}]`;
    const edge = record(value, p, issues);
    if (!edge) return;
    keys(edge, ["id", "transition"], p, issues);
    string(edge.id, `${p}.id`, issues);
    if (typeof edge.id === "string") {
      if (ids.has(edge.id))
        addProjectIssue(issues, "elevation.edge", p, "Edge IDs must be unique.");
      ids.add(edge.id);
    }
    if (edge.transition === undefined) return;
    const transition = record(edge.transition, `${p}.transition`, issues);
    if (!transition) return;
    keys(transition, transition.kind === "sloped" ? ["kind", "widthMeters"] : ["kind"], p, issues);
    if (transition.kind === "sloped") {
      finite(transition.widthMeters, `${p}.transition.widthMeters`, issues);
      if (typeof transition.widthMeters === "number" && transition.widthMeters <= 0)
        addProjectIssue(issues, "elevation.slope", p, "Transition width must be positive.");
    } else if (transition.kind !== "sharp")
      addProjectIssue(issues, "elevation.edge", p, "Choose a sharp or sloped transition.");
  });
}
