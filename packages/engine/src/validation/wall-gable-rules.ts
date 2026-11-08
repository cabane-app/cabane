import type { ManifestIssue } from "../types";
import { MAX_GABLE_COLUMNS, MAX_GABLE_TRANSOMS } from "../wall-types";
import { isFiniteNumber, isNonEmptyString, isObject, issue } from "./core";

export const WALL_GABLE_GLASS_FIELDS = ["frameColor", "columns", "transomHeightsMeters"] as const;

export function validateWallGable(value: unknown, path: string): ManifestIssue[] {
  if (!isObject(value) || (value.fill !== "solid" && value.fill !== "glass"))
    return [issue("wall.gable-fill", `${path}.fill`, "Wall gable fill must be solid or glass.")];
  if (value.fill === "solid")
    return WALL_GABLE_GLASS_FIELDS.flatMap((field) =>
      value[field] === undefined
        ? []
        : [
            issue(
              "wall.gable-glass-field",
              `${path}.${field}`,
              "This setting requires glass fill.",
            ),
          ],
    );

  const { columns, frameColor, transomHeightsMeters } = value;
  const issues: ManifestIssue[] = [];
  if (frameColor !== undefined && !isNonEmptyString(frameColor))
    issues.push(
      issue("wall.gable-frame-color", `${path}.frameColor`, "Use a non-empty frame color."),
    );
  if (
    columns !== undefined &&
    (typeof columns !== "number" ||
      !Number.isInteger(columns) ||
      columns < 1 ||
      columns > MAX_GABLE_COLUMNS)
  )
    issues.push(
      issue("wall.gable-columns", `${path}.columns`, `Use 1 to ${MAX_GABLE_COLUMNS} glass panes.`),
    );
  if (transomHeightsMeters !== undefined) {
    const transomPath = `${path}.transomHeightsMeters`;
    if (!Array.isArray(transomHeightsMeters) || transomHeightsMeters.length > MAX_GABLE_TRANSOMS)
      issues.push(
        issue("wall.gable-transoms", transomPath, `Use at most ${MAX_GABLE_TRANSOMS} transoms.`),
      );
    else
      transomHeightsMeters.forEach((height, index) => {
        if (!isFiniteNumber(height) || height <= 0)
          issues.push(
            issue(
              "wall.gable-transom-height",
              `${transomPath}[${index}]`,
              "Use a positive height above the floor.",
            ),
          );
      });
  }
  return issues;
}
