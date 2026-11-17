import { elevationSettings } from "./schema-elevation";
import { keys, record, array, string, finite, polygon } from "./schema-json-values";
import { floorFinish } from "./schema-floor-finish";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";
import { OUTDOOR_PLATFORM_EDGE_PRESETS } from "../outdoor-platforms/platform-barriers";

export const outdoorPlatforms = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const edgeConfiguration = (value: unknown, edgePath: string) => {
    const c = record(value, edgePath, issues);
    if (!c) return;
    keys(c, ["kind", "heightMeters"], edgePath, issues);
    if (!OUTDOOR_PLATFORM_EDGE_PRESETS.some((preset) => preset.id === c.kind))
      addProjectIssue(issues, "project.platform-edge", edgePath, "Unknown platform edge style.");
    if (c.kind !== "open") finite(c.heightMeters, `${edgePath}.heightMeters`, issues);
    else if (c.heightMeters !== undefined)
      addProjectIssue(
        issues,
        "project.platform-edge",
        edgePath,
        "Open edges do not have a barrier height.",
      );
  };
  array(value, path, issues)?.forEach((entry, index) => {
    const p = `${path}[${index}]`;
    const platform = record(entry, p, issues);
    if (!platform) return;
    keys(
      platform,
      ["id", "polygon", "finish", "defaultEdge", "edges", "useAsRoom", "roomName", "elevation"],
      p,
      issues,
    );
    if (platform.useAsRoom !== undefined && typeof platform.useAsRoom !== "boolean")
      addProjectIssue(
        issues,
        "project.platform-room",
        `${p}.useAsRoom`,
        "Use as room must be a boolean.",
      );
    if (platform.roomName !== undefined && typeof platform.roomName !== "string")
      string(platform.roomName, `${p}.roomName`, issues);
    if (platform.elevation !== undefined)
      elevationSettings(platform.elevation, `${p}.elevation`, issues);
    string(platform.id, `${p}.id`, issues);
    polygon(platform.polygon, `${p}.polygon`, issues);
    floorFinish(platform.finish, `${p}.finish`, issues);
    edgeConfiguration(platform.defaultEdge, `${p}.defaultEdge`);
    array(platform.edges, `${p}.edges`, issues)?.forEach((entry, i) => {
      const edgePath = `${p}.edges[${i}]`;
      const edge = record(entry, edgePath, issues);
      if (!edge) return;
      keys(edge, ["id", "configuration"], edgePath, issues);
      string(edge.id, `${edgePath}.id`, issues);
      if (edge.configuration !== undefined)
        edgeConfiguration(edge.configuration, `${edgePath}.configuration`);
    });
  });
};
