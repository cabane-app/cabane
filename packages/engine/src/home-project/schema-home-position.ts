import { finite, keys, record } from "./schema-json-values";
import { FLAT_TERRAIN } from "../terrain/terrain-settings";
import { addProjectIssue, type HomeProjectIssue, type JsonRecord } from "./validation-types";

export function validateHomePosition(home: JsonRecord, issues: HomeProjectIssue[]) {
  if (home.terrain !== undefined) {
    const terrain = record(home.terrain, "home.terrain", issues);
    if (terrain) {
      keys(terrain, Object.keys(FLAT_TERRAIN), "home.terrain", issues);
      for (const corner of Object.keys(FLAT_TERRAIN)) {
        finite(terrain[corner], `home.terrain.${corner}`, issues);
        if (typeof terrain[corner] === "number" && Math.abs(terrain[corner]) > 100)
          addProjectIssue(
            issues,
            "project.terrain-height",
            `home.terrain.${corner}`,
            "Terrain heights must be between −100 and 100 metres.",
          );
      }
    }
  }
  if (
    home.apartmentFloor !== undefined &&
    (typeof home.apartmentFloor !== "number" ||
      !Number.isInteger(home.apartmentFloor) ||
      home.apartmentFloor < 0 ||
      home.apartmentFloor > 100)
  )
    addProjectIssue(
      issues,
      "project.apartment-floor",
      "home.apartmentFloor",
      "Choose a whole floor number between 0 and 100.",
    );
  if (home.northAngleDegrees !== undefined) {
    finite(home.northAngleDegrees, "home.northAngleDegrees", issues);
    if (
      typeof home.northAngleDegrees === "number" &&
      (home.northAngleDegrees < 0 || home.northAngleDegrees >= 360)
    )
      addProjectIssue(
        issues,
        "project.north-angle",
        "home.northAngleDegrees",
        "North angle must be at least 0 and less than 360 degrees.",
      );
  }
}
