import { validateWallNiches } from "./wall-niche-rules";
import { wallLengthPlanUnits } from "../geometry";

import type { ManifestIssue } from "../types";

import {
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isPlanPoint,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

import { ValidWall } from "./architecture-validation-contract";

export const validateWalls = (
  rawFloor: RawObject,
  floorPath: string,
  context: ValidationContext,
) => {
  const issues: ManifestIssue[] = [];
  const wallIds = new Set<string>();
  const walls = Array.isArray(rawFloor.walls) ? rawFloor.walls : [];
  if (
    !Array.isArray(rawFloor.walls) ||
    (rawFloor.walls.length === 0 &&
      !(Array.isArray(rawFloor.outdoorPlatforms) && rawFloor.outdoorPlatforms.length))
  ) {
    issues.push(
      issue("walls.required", `${floorPath}.walls`, "A floor must contain architectural walls."),
    );
  }
  walls.forEach((rawWall, wallIndex) => {
    const wallPath = `${floorPath}.walls[${wallIndex}]`;
    if (!isObject(rawWall)) {
      issues.push(issue("wall.type", wallPath, "Each wall must be an object."));
      return;
    }
    issues.push(...registerId(context, rawWall.id, `${wallPath}.id`));
    if (isNonEmptyString(rawWall.id)) wallIds.add(rawWall.id);
    if (!isPlanPoint(rawWall.from) || !isPlanPoint(rawWall.to)) {
      issues.push(issue("wall.points", wallPath, "Wall endpoints must be finite plan points."));
    } else if (wallLengthPlanUnits(rawWall as never) <= 0) {
      issues.push(issue("wall.length", wallPath, "Walls must have non-zero length."));
    }
    if (!["interior", "exterior"].includes(String(rawWall.classification))) {
      issues.push(
        issue(
          "wall.classification",
          `${wallPath}.classification`,
          "Wall classification must be interior or exterior.",
        ),
      );
    }
    if (!isFiniteNumber(rawWall.thicknessMeters) || rawWall.thicknessMeters <= 0) {
      issues.push(
        issue(
          "wall.thickness",
          `${wallPath}.thicknessMeters`,
          "Wall thickness must be greater than zero.",
        ),
      );
    }
    if (rawWall.virtual !== undefined && typeof rawWall.virtual !== "boolean") {
      issues.push(
        issue(
          "wall.virtual",
          `${wallPath}.virtual`,
          "Wall virtual flag must be a boolean when supplied.",
        ),
      );
    }
    if (isPlanPoint(rawWall.from) && isPlanPoint(rawWall.to))
      issues.push(...validateWallNiches(rawWall, rawFloor, wallPath, context));
    if (rawWall.exteriorColor !== undefined && !isNonEmptyString(rawWall.exteriorColor)) {
      issues.push(
        issue(
          "wall.exterior-color",
          `${wallPath}.exteriorColor`,
          "Wall exterior color must be a non-empty CSS color when supplied.",
        ),
      );
    }
    if (rawWall.edgeColor !== undefined && !isNonEmptyString(rawWall.edgeColor)) {
      issues.push(
        issue(
          "wall.edge-color",
          `${wallPath}.edgeColor`,
          "Wall edge color must be a non-empty CSS color when supplied.",
        ),
      );
    }
    if (rawWall.faceColors !== undefined) {
      if (!isObject(rawWall.faceColors)) {
        issues.push(
          issue(
            "wall.face-colors",
            `${wallPath}.faceColors`,
            "Wall faceColors must be an object when supplied.",
          ),
        );
      } else {
        for (const side of ["left", "right"] as const) {
          if (
            rawWall.faceColors[side] !== undefined &&
            !isNonEmptyString(rawWall.faceColors[side])
          ) {
            issues.push(
              issue(
                "wall.face-color",
                `${wallPath}.faceColors.${side}`,
                `Wall ${side} face color must be a non-empty CSS color when supplied.`,
              ),
            );
          }
        }
      }
    }
  });
  const validWalls = walls.filter(
    (wall): wall is ValidWall =>
      isObject(wall) &&
      isNonEmptyString(wall.id) &&
      isPlanPoint(wall.from) &&
      isPlanPoint(wall.to) &&
      isFiniteNumber(wall.thicknessMeters) &&
      wall.thicknessMeters > 0,
  );
  return { issues, walls, wallIds, validWalls };
};
