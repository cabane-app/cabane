import { isPlatformRoomRecord } from "./platform-room";
import { pointInsidePolygon, polygonSelfIntersects, polygonSignedArea } from "../geometry";

import { type ManifestIssue } from "../types";

import {
  extensionHas,
  isNonEmptyString,
  isObject,
  isPolygon,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

import { validateDevice } from "./device-rules";
import { validateEntitySlot } from "./entity-slot-rules";
import { validateFloorFinish, validateFloorZones } from "./floor-finish-rules";
import { pointOnPolygonBoundary } from "./geometry";

export interface RoomValidationResult {
  issues: readonly ManifestIssue[];
  roomIds: Set<string>;
}

export const validateRooms = (
  rawFloor: RawObject,
  floorPath: string,
  footprint: unknown,
  context: ValidationContext,
): RoomValidationResult => {
  const issues: ManifestIssue[] = [];
  const roomIds = new Set<string>();
  if (
    !Array.isArray(rawFloor.rooms) ||
    (rawFloor.rooms.length === 0 &&
      !(Array.isArray(rawFloor.outdoorPlatforms) && rawFloor.outdoorPlatforms.length) &&
      !(Array.isArray(rawFloor.solidRooms) && rawFloor.solidRooms.length))
  ) {
    issues.push(
      issue("rooms.required", `${floorPath}.rooms`, "A floor must contain at least one room."),
    );
    return { issues, roomIds };
  }

  rawFloor.rooms.forEach((rawRoom, roomIndex) => {
    const roomPath = `${floorPath}.rooms[${roomIndex}]`;
    if (!isObject(rawRoom)) {
      issues.push(issue("room.type", roomPath, "Each room must be an object."));
      return;
    }
    issues.push(...registerId(context, rawRoom.id, `${roomPath}.id`));
    if (isNonEmptyString(rawRoom.id)) roomIds.add(rawRoom.id);
    if (!isNonEmptyString(rawRoom.name)) {
      issues.push(issue("room.name", `${roomPath}.name`, "Room name is required."));
    }
    if (!isNonEmptyString(rawRoom.accent)) {
      issues.push(
        issue("room.accent", `${roomPath}.accent`, "Room accent must be a non-empty CSS color."),
      );
    }
    if (rawRoom.floorFinish !== undefined) {
      issues.push(...validateFloorFinish(rawRoom.floorFinish, `${roomPath}.floorFinish`));
    }
    issues.push(...validateFloorZones(rawRoom, roomPath, context));
    if (!isPolygon(rawRoom.polygon)) {
      issues.push(
        issue(
          "room.polygon",
          `${roomPath}.polygon`,
          "Room polygon must contain at least three finite points.",
        ),
      );
    } else {
      if (
        Math.abs(polygonSignedArea(rawRoom.polygon)) < 1e-8 ||
        polygonSelfIntersects(rawRoom.polygon)
      ) {
        issues.push(
          issue(
            "room.polygon-invalid",
            `${roomPath}.polygon`,
            "Room polygon must be simple and have a non-zero area.",
          ),
        );
      }
      if (isPolygon(footprint) && !isPlatformRoomRecord(rawFloor, rawRoom)) {
        rawRoom.polygon.forEach((point, pointIndex) => {
          if (!pointInsidePolygon(point, footprint) && !pointOnPolygonBoundary(point, footprint)) {
            issues.push(
              issue(
                "room.outside-footprint",
                `${roomPath}.polygon[${pointIndex}]`,
                "Room points must lie inside the floor footprint.",
              ),
            );
          }
        });
      }
    }
    if (!Array.isArray(rawRoom.dashboardSlots)) {
      issues.push(
        issue(
          "dashboard-slots.type",
          `${roomPath}.dashboardSlots`,
          "Room dashboard slots must be an array.",
        ),
      );
    } else {
      rawRoom.dashboardSlots.forEach((rawSlot, slotIndex) => {
        issues.push(
          ...validateEntitySlot(rawSlot, `${roomPath}.dashboardSlots[${slotIndex}]`, context),
        );
      });
    }
    if (!Array.isArray(rawRoom.devices)) {
      issues.push(issue("devices.type", `${roomPath}.devices`, "Room devices must be an array."));
    } else {
      rawRoom.devices.forEach((rawDevice, deviceIndex) => {
        issues.push(
          ...validateDevice(
            rawDevice,
            `${roomPath}.devices[${deviceIndex}]`,
            rawRoom,
            rawFloor,
            context,
          ),
        );
      });
    }
    if (
      isNonEmptyString(rawRoom.furnishings) &&
      !extensionHas(context.input, "roomFurnishings", rawRoom.furnishings)
    ) {
      issues.push(
        issue(
          "room.furnishings-extension",
          `${roomPath}.furnishings`,
          `Room extension "${rawRoom.furnishings}" is not registered.`,
        ),
      );
    }
  });
  return { issues, roomIds };
};
export { validateFloorFinish } from "./floor-finish-rules";
