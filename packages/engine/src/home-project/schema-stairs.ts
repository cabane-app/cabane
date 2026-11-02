import { keys, record, string, finite, point } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

export const stairSchema = (entry: unknown, path: string, issues: HomeProjectIssue[]) => {
  const stair = record(entry, path, issues);
  if (!stair) return;
  const shape = stair.shape ?? "straight";
  if (
    stair.style !== undefined &&
    !["open", "concrete", "stone"].includes(typeof stair.style === "string" ? stair.style : "")
  )
    addProjectIssue(
      issues,
      "stair.style",
      `${path}.style`,
      "Choose Open treads, Concrete, or Stone.",
    );
  if (
    stair.railings !== undefined &&
    !["both", "left", "right", "none"].includes(
      typeof stair.railings === "string" ? stair.railings : "",
    )
  )
    addProjectIssue(
      issues,
      "stair.railings",
      `${path}.railings`,
      "Choose Both, Left, Right, or None.",
    );
  const dimensions =
    shape === "spiral"
      ? ["diameterMeters", "totalTurnDegrees"]
      : shape === "l-shaped" || shape === "u-shaped"
        ? ["widthMeters", "lowerRunMeters", "upperRunMeters"]
        : ["widthMeters", "runMeters"];
  keys(
    stair,
    [
      "id",
      ...(stair.terrain === undefined ? ["lowerFloorId", "upperFloorId"] : ["terrain"]),
      "at",
      "rotationYRadians",
      "shape",
      "style",
      "railings",
      ...dimensions,
      ...(shape === "spiral"
        ? ["direction"]
        : shape === "l-shaped" || shape === "u-shaped"
          ? ["turn"]
          : []),
    ],
    path,
    issues,
  );
  if (
    !["straight", "l-shaped", "u-shaped", "spiral"].includes(typeof shape === "string" ? shape : "")
  )
    addProjectIssue(issues, "stair.shape", `${path}.shape`, "Unknown stair shape.");
  if (shape === "spiral" && !["clockwise", "counterclockwise"].includes(String(stair.direction)))
    addProjectIssue(
      issues,
      "stair.direction",
      `${path}.direction`,
      "Choose clockwise or counterclockwise.",
    );
  if (
    (shape === "l-shaped" || shape === "u-shaped") &&
    !["left", "right"].includes(String(stair.turn))
  )
    addProjectIssue(issues, "stair.turn", `${path}.turn`, "Choose left or right.");
  for (const key of stair.terrain === undefined ? ["id", "lowerFloorId", "upperFloorId"] : ["id"])
    string(stair[key], `${path}.${key}`, issues);
  if (stair.terrain !== undefined) {
    const terrain = record(stair.terrain, `${path}.terrain`, issues);
    if (terrain) {
      keys(terrain, ["floorId", "end"], `${path}.terrain`, issues);
      string(terrain.floorId, `${path}.terrain.floorId`, issues);
      if (terrain.end !== "lower" && terrain.end !== "upper")
        addProjectIssue(
          issues,
          "stair.connection",
          `${path}.terrain.end`,
          "Choose a lower or upper terrain landing.",
        );
    }
  }
  point(stair.at, `${path}.at`, issues);
  for (const key of ["rotationYRadians", ...dimensions])
    finite(stair[key], `${path}.${key}`, issues);
};
