import { floorZoneWithinRoom, isFloorZoneOutline } from "../floor-finishes/finish-geometry";

import { FLOOR_PATTERN_PRESET_IDS, type ManifestIssue, type Polygon } from "../types";

import {
  isNonEmptyString,
  isObject,
  isPolygon,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

const floorPresetIds = new Set<string>(FLOOR_PATTERN_PRESET_IDS);

export const validateFloorFinish = (raw: unknown, path: string): ManifestIssue[] => {
  if (!isObject(raw)) {
    return [issue("floor-finish.type", path, "Floor finish must be an object.")];
  }
  if (raw.kind === "grass") return [];
  if (raw.kind === "solid") {
    return isNonEmptyString(raw.color)
      ? []
      : [
          issue(
            "floor-finish.color",
            `${path}.color`,
            "Solid floor finish requires a non-empty CSS color.",
          ),
        ];
  }
  if (raw.kind === "preset") {
    if (
      raw.color !== undefined &&
      (typeof raw.color !== "string" || !/^#[0-9a-f]{6}$/i.test(raw.color))
    ) {
      return [
        issue("floor-finish.color", `${path}.color`, "Tile color must be a six-digit hex color."),
      ];
    }
    return floorPresetIds.has(String(raw.preset))
      ? []
      : [issue("floor-finish.preset", `${path}.preset`, "Floor preset is not supported.")];
  }
  return [
    issue(
      "floor-finish.kind",
      `${path}.kind`,
      "Floor finish kind must be solid, preset, or grass.",
    ),
  ];
};

export const validateFloorZones = (
  rawRoom: RawObject,
  roomPath: string,
  context: ValidationContext,
): ManifestIssue[] => {
  if (rawRoom.floorZones === undefined) return [];
  if (!Array.isArray(rawRoom.floorZones)) {
    return [
      issue("floor-zones.type", `${roomPath}.floorZones`, "Room floorZones must be an array."),
    ];
  }
  const roomPolygon = isPolygon(rawRoom.polygon) ? (rawRoom.polygon as Polygon) : null;
  return rawRoom.floorZones.flatMap((rawZone, zoneIndex) => {
    const path = `${roomPath}.floorZones[${zoneIndex}]`;
    if (!isObject(rawZone)) {
      return [issue("floor-zone.type", path, "Floor zone must be an object.")];
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
          "Floor zone must be a simple polygon with non-zero area.",
        ),
      );
    } else if (roomPolygon && !floorZoneWithinRoom(rawZone.polygon, roomPolygon)) {
      zoneIssues.push(
        issue(
          "floor-zone.outside-room",
          `${path}.polygon`,
          "Floor zone must stay inside its room.",
        ),
      );
    }
    return zoneIssues;
  });
};
