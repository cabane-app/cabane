import { slopedCeilingProjection } from "../architecture-geometry/sloped-ceiling-plane";
import { polygonSelfIntersects, polygonSignedArea } from "../geometry";
import type { ManifestIssue, PlanPoint } from "../types";

import {
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isPlanPoint,
  isPolygon,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

const isSlopeEdge = (value: unknown): value is readonly [PlanPoint, PlanPoint] => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [from, to] = value as unknown[];
  if (!isPlanPoint(from) || !isPlanPoint(to)) return false;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return Number.isFinite(length) && length > 0;
};

export const validateSlopedCeilingPlanes = (planes: unknown, path: string): ManifestIssue[] => {
  if (!Array.isArray(planes) || !planes.length) {
    return [issue("ceiling.planes", path, "A sloped ceiling requires at least one plane.")];
  }
  const issues: ManifestIssue[] = [];
  const ids = new Set<string>();
  for (const [index, plane] of planes.entries()) {
    const planePath = `${path}[${index}]`;
    if (!isObject(plane)) {
      issues.push(issue("ceiling.plane", planePath, "Each ceiling plane must be an object."));
      continue;
    }
    if (!isNonEmptyString(plane.id) || ids.has(plane.id)) {
      issues.push(
        issue("ceiling.plane-id", `${planePath}.id`, "Each plane needs a unique, nonempty ID."),
      );
    } else {
      ids.add(plane.id);
    }
    const boundary = isPolygon(plane.boundary) ? plane.boundary : null;
    const area = boundary ? Math.abs(polygonSignedArea(boundary)) : 0;
    if (!boundary || !Number.isFinite(area) || area < 1e-8 || polygonSelfIntersects(boundary)) {
      issues.push(
        issue(
          "ceiling.plane-boundary",
          `${planePath}.boundary`,
          "Use a simple polygon with nonzero area.",
        ),
      );
    }
    const { lowEdge, highEdge, lowHeightMeters, highHeightMeters } = plane;
    if (!isSlopeEdge(lowEdge) || !isSlopeEdge(highEdge)) {
      issues.push(
        issue(
          "ceiling.plane-edge",
          planePath,
          "The low and high edges each need two distinct plan points.",
        ),
      );
    } else {
      const progressAt = slopedCeilingProjection({ lowEdge, highEdge });
      const tolerance = 1e-7;
      if (!progressAt || !highEdge.every((point) => Math.abs(progressAt(point) - 1) <= tolerance)) {
        issues.push(
          issue(
            "ceiling.plane-axis",
            planePath,
            "Use parallel low and high edges on distinct lines.",
          ),
        );
      } else if (
        boundary &&
        !boundary.every((point) => {
          const progress = progressAt(point);
          return progress >= -tolerance && progress <= 1 + tolerance;
        })
      ) {
        issues.push(
          issue(
            "ceiling.plane-span",
            `${planePath}.boundary`,
            "The plane boundary must lie between the low and high edges.",
          ),
        );
      }
    }
    if (
      !isFiniteNumber(lowHeightMeters) ||
      !isFiniteNumber(highHeightMeters) ||
      lowHeightMeters < 0 ||
      highHeightMeters <= lowHeightMeters ||
      !Number.isFinite(highHeightMeters - lowHeightMeters)
    ) {
      issues.push(
        issue(
          "ceiling.plane-height",
          planePath,
          "Sloped ceiling heights must be at or above the floor, with the high edge above the low edge.",
        ),
      );
    }
  }
  return issues;
};

export const validateCeilings = (
  rawFloor: RawObject,
  floorPath: string,
  roomIds: Set<string>,
  context: ValidationContext,
) => {
  const issues: ManifestIssue[] = [];
  if (rawFloor.ceilings !== undefined && !Array.isArray(rawFloor.ceilings)) {
    return [issue("ceilings.type", `${floorPath}.ceilings`, "Ceilings must be an array.")];
  }
  if (!Array.isArray(rawFloor.ceilings)) return issues;
  rawFloor.ceilings.forEach((rawCeiling, ceilingIndex) => {
    const ceilingPath = `${floorPath}.ceilings[${ceilingIndex}]`;
    if (!isObject(rawCeiling)) {
      issues.push(issue("ceiling.type", ceilingPath, "Each ceiling must be an object."));
      return;
    }
    issues.push(...registerId(context, rawCeiling.id, `${ceilingPath}.id`));
    if (
      !Array.isArray(rawCeiling.roomIds) ||
      (rawCeiling.kind === "sloped" && rawCeiling.roomIds.length === 0) ||
      rawCeiling.roomIds.some((id) => typeof id !== "string" || !roomIds.has(id))
    ) {
      issues.push(
        issue(
          "ceiling.rooms",
          `${ceilingPath}.roomIds`,
          "Ceiling room IDs must reference rooms on this floor.",
        ),
      );
    }
    if (rawCeiling.kind === "flat") {
      if (!isFiniteNumber(rawCeiling.heightMeters) || rawCeiling.heightMeters <= 0) {
        issues.push(
          issue(
            "ceiling.height",
            `${ceilingPath}.heightMeters`,
            "Flat ceiling height must be greater than zero.",
          ),
        );
      }
    } else if (rawCeiling.kind === "sloped") {
      issues.push(...validateSlopedCeilingPlanes(rawCeiling.planes, `${ceilingPath}.planes`));
    } else {
      issues.push(
        issue("ceiling.kind", `${ceilingPath}.kind`, "Ceiling kind must be flat or sloped."),
      );
    }
  });
  return issues;
};
