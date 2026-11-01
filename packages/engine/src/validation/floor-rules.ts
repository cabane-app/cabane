import { isPlatformRoomRecord } from "./platform-room";
import { validateOutdoorPlatforms } from "./platform-rules";
import { validateHedges } from "./hedge-rules";
import { pointInsidePolygon, polygonSelfIntersects, polygonSignedArea } from "../geometry";
import { groundZoneOutsideFootprint, isFloorZoneOutline } from "../floor-finishes/finish-geometry";
import type { ManifestIssue, Polygon } from "../types";
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
  type ValidationRule,
} from "./core";
import { validateArchitecture } from "./architecture-rules";
import { pointOnPolygonBoundary } from "./geometry";
import { validateFloorFinish, validateRooms } from "./room-rules";
import { validatePools } from "./pool-rules";

const validateGroundZones = (
  rawFloor: RawObject,
  floorPath: string,
  context: ValidationContext,
): readonly ManifestIssue[] => {
  if (rawFloor.groundZones === undefined) return [];
  if (!Array.isArray(rawFloor.groundZones)) {
    return [
      issue("ground-zones.type", `${floorPath}.groundZones`, "Floor groundZones must be an array."),
    ];
  }
  const footprint = isPolygon(rawFloor.footprint) ? (rawFloor.footprint as Polygon) : null;
  const regions =
    Array.isArray(rawFloor.footprintRegions) && rawFloor.footprintRegions.every(isPolygon)
      ? (rawFloor.footprintRegions as Polygon[])
      : undefined;
  return rawFloor.groundZones.flatMap((rawZone, zoneIndex) => {
    const path = `${floorPath}.groundZones[${zoneIndex}]`;
    if (!isObject(rawZone)) {
      return [issue("floor-zone.type", path, "Ground zone must be an object.")];
    }
    const zoneIssues = [
      ...registerId(context, rawZone.id, `${path}.id`),
      ...validateFloorFinish(rawZone.finish, `${path}.finish`),
    ];
    if (!isFloorZoneOutline(rawZone.polygon)) {
      zoneIssues.push(
        issue(
          "floor-zone.polygon",
          `${path}.polygon`,
          "Ground zone must be a simple polygon with non-zero area.",
        ),
      );
    } else if (
      footprint &&
      !groundZoneOutsideFootprint(rawZone.polygon, {
        footprint,
        ...(regions ? { footprintRegions: regions } : {}),
      })
    ) {
      zoneIssues.push(
        issue(
          "ground-zone.inside-footprint",
          `${path}.polygon`,
          "Outdoor ground zones must stay outside the building footprint.",
        ),
      );
    }
    return zoneIssues;
  });
};

const validateFloor = (
  rawFloor: unknown,
  floorIndex: number,
  context: ValidationContext,
): readonly ManifestIssue[] => {
  const floorPath = `floors[${floorIndex}]`;
  if (!isObject(rawFloor)) {
    return [issue("floor.type", floorPath, "Each floor must be an object.")];
  }

  const issues: ManifestIssue[] = [...registerId(context, rawFloor.id, `${floorPath}.id`)];
  if (rawFloor.belowGround !== undefined && typeof rawFloor.belowGround !== "boolean")
    issues.push(
      issue(
        "floor.basement",
        `${floorPath}.belowGround`,
        "Basement classification must be a boolean.",
      ),
    );
  if (!isNonEmptyString(rawFloor.name)) {
    issues.push(issue("floor.name", `${floorPath}.name`, "Floor name is required."));
  }
  if (!isObject(rawFloor.coordinates)) {
    issues.push(
      issue("floor.coordinates", `${floorPath}.coordinates`, "Floor coordinates are required."),
    );
  } else {
    if (!isPlanPoint(rawFloor.coordinates.origin)) {
      issues.push(
        issue(
          "coordinates.origin",
          `${floorPath}.coordinates.origin`,
          "Origin must be a finite plan point.",
        ),
      );
    }
    if (
      !isFiniteNumber(rawFloor.coordinates.metersPerPlanUnit) ||
      rawFloor.coordinates.metersPerPlanUnit <= 0
    ) {
      issues.push(
        issue(
          "coordinates.scale",
          `${floorPath}.coordinates.metersPerPlanUnit`,
          "Scale must be greater than zero.",
        ),
      );
    }
    if (!["measured", "inferred"].includes(String(rawFloor.coordinates.scaleBasis))) {
      issues.push(
        issue(
          "coordinates.basis",
          `${floorPath}.coordinates.scaleBasis`,
          "Scale basis must be measured or inferred.",
        ),
      );
    }
  }
  for (const [key, label] of [
    ["defaultWallHeightMeters", "Default wall height"],
    ["defaultCeilingHeightMeters", "Default ceiling height"],
  ] as const) {
    if (!isFiniteNumber(rawFloor[key]) || rawFloor[key] <= 0) {
      issues.push(
        issue("floor.height", `${floorPath}.${key}`, `${label} must be greater than zero.`),
      );
    }
  }

  const footprint = rawFloor.footprint;
  if (!isPolygon(footprint)) {
    issues.push(
      issue(
        "footprint.polygon",
        `${floorPath}.footprint`,
        "The footprint must contain at least three finite points.",
      ),
    );
  } else {
    if (Math.abs(polygonSignedArea(footprint)) < 1e-8) {
      issues.push(
        issue(
          "footprint.area",
          `${floorPath}.footprint`,
          "The footprint must have a non-zero area.",
        ),
      );
    }
    if (polygonSelfIntersects(footprint)) {
      issues.push(
        issue(
          "footprint.self-intersection",
          `${floorPath}.footprint`,
          "The footprint must not intersect itself.",
        ),
      );
    }
  }

  const footprintRegions = rawFloor.footprintRegions;
  if (footprintRegions !== undefined) {
    if (!Array.isArray(footprintRegions) || footprintRegions.length < 2) {
      issues.push(
        issue(
          "footprint-regions.required",
          `${floorPath}.footprintRegions`,
          "Disjoint footprint regions must contain at least two polygons.",
        ),
      );
    } else {
      footprintRegions.forEach((region, regionIndex) => {
        const regionPath = `${floorPath}.footprintRegions[${regionIndex}]`;
        if (
          !isPolygon(region) ||
          Math.abs(polygonSignedArea(region)) < 1e-8 ||
          polygonSelfIntersects(region)
        ) {
          issues.push(
            issue(
              "footprint-regions.polygon",
              regionPath,
              "Each footprint region must be a simple polygon with non-zero area.",
            ),
          );
          return;
        }
        if (isPolygon(footprint))
          region.forEach((candidate, pointIndex) => {
            if (
              !pointInsidePolygon(candidate, footprint) &&
              !pointOnPolygonBoundary(candidate, footprint)
            ) {
              issues.push(
                issue(
                  "footprint-regions.outside-envelope",
                  `${regionPath}[${pointIndex}]`,
                  "Footprint regions must stay inside the common floor envelope.",
                ),
              );
            }
          });
      });
    }
  }

  const roomValidation = validateRooms(rawFloor, floorPath, footprint, context);
  issues.push(...roomValidation.issues);
  issues.push(...validateGroundZones(rawFloor, floorPath, context));
  if (
    Array.isArray(footprintRegions) &&
    footprintRegions.every(isPolygon) &&
    Array.isArray(rawFloor.rooms)
  ) {
    rawFloor.rooms.forEach((rawRoom, roomIndex) => {
      if (
        !isObject(rawRoom) ||
        !isPolygon(rawRoom.polygon) ||
        isPlatformRoomRecord(rawFloor, rawRoom)
      )
        return;
      rawRoom.polygon.forEach((candidate, pointIndex) => {
        const insideRegion = footprintRegions.some(
          (region) =>
            pointInsidePolygon(candidate, region) || pointOnPolygonBoundary(candidate, region),
        );
        if (!insideRegion)
          issues.push(
            issue(
              "room.outside-footprint-region",
              `${floorPath}.rooms[${roomIndex}].polygon[${pointIndex}]`,
              "Room points must lie inside one exact footprint region.",
            ),
          );
      });
    });
  }
  issues.push(...validateArchitecture(rawFloor, floorPath, roomValidation.roomIds, context));
  issues.push(...validateHedges(rawFloor, floorPath, context));
  issues.push(...validateOutdoorPlatforms(rawFloor, floorPath, context));
  issues.push(...validatePools(rawFloor, floorPath, context));
  return issues;
};

export const validateFloors: ValidationRule<RawObject> = (input, context) => {
  if (!Array.isArray(input.floors)) return [];
  return input.floors.flatMap((rawFloor, floorIndex) =>
    validateFloor(rawFloor, floorIndex, context),
  );
};
