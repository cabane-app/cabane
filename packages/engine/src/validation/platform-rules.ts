import { isPlatformRoomRecord } from "./platform-room";
import {
  isOutdoorPlatformOutline,
  platformPolygonsOverlap,
} from "../outdoor-platforms/platform-geometry";
import { validPlatformEdgeConfiguration } from "../outdoor-platforms/platform-barriers";
import { validateFloorFinish } from "./room-rules";
import { isObject, issue, registerId, type RawObject, type ValidationContext } from "./core";
import type { ManifestIssue, Polygon } from "../types";
export function validateOutdoorPlatforms(
  floor: RawObject,
  path: string,
  context: ValidationContext,
): ManifestIssue[] {
  if (floor.outdoorPlatforms === undefined) return [];
  if (!Array.isArray(floor.outdoorPlatforms))
    return [
      issue(
        "platform.collection",
        `${path}.outdoorPlatforms`,
        "Outdoor platforms must be an array.",
      ),
    ];
  const previous: Polygon[] = [];
  return floor.outdoorPlatforms.flatMap((platform, index) => {
    const p = `${path}.outdoorPlatforms[${index}]`;
    if (!isObject(platform)) return [issue("platform.type", p, "Platform must be an object.")];
    const issues = [
      ...registerId(context, platform.id, `${p}.id`),
      ...validateFloorFinish(platform.finish, `${p}.finish`),
    ];
    if (platform.useAsRoom !== undefined && typeof platform.useAsRoom !== "boolean")
      issues.push(
        issue("platform.room-option", `${p}.useAsRoom`, "Use as room must be a boolean."),
      );
    if (platform.useAsRoom && (typeof platform.roomName !== "string" || !platform.roomName.trim()))
      issues.push(
        issue("platform.room-name", `${p}.roomName`, "Name the outdoor room before saving."),
      );
    if (!validPlatformEdgeConfiguration(platform.defaultEdge))
      issues.push(
        issue(
          "platform.edge-configuration",
          `${p}.defaultEdge`,
          "Choose Railing, Low wall, or Open with a positive height.",
        ),
      );
    if (
      !Array.isArray(platform.edges) ||
      !Array.isArray(platform.polygon) ||
      platform.edges.length !== platform.polygon.length
    )
      issues.push(
        issue("platform.edges", `${p}.edges`, "Each polygon edge needs a stable edge record."),
      );
    if (Array.isArray(platform.edges))
      platform.edges.forEach((edge, i) => {
        if (!isObject(edge)) {
          issues.push(issue("platform.edge", `${p}.edges[${i}]`, "Edge must be an object."));
          return;
        }
        issues.push(...registerId(context, edge.id, `${p}.edges[${i}].id`));
        if (edge.configuration !== undefined && !validPlatformEdgeConfiguration(edge.configuration))
          issues.push(
            issue(
              "platform.edge-configuration",
              `${p}.edges[${i}].configuration`,
              "Use a valid edge style and height.",
            ),
          );
      });
    if (!isOutdoorPlatformOutline(platform.polygon))
      issues.push(
        issue(
          "platform.polygon",
          `${p}.polygon`,
          "Draw at least three distinct corners without crossings or backtracking.",
        ),
      );
    else {
      const polygon = platform.polygon;
      if (
        Array.isArray(floor.rooms) &&
        floor.rooms.some(
          (room) =>
            isObject(room) &&
            !isPlatformRoomRecord(floor, room) &&
            isOutdoorPlatformOutline(room.polygon) &&
            platformPolygonsOverlap(polygon, room.polygon),
        )
      )
        issues.push(
          issue(
            "platform.room-overlap",
            `${p}.polygon`,
            "Outdoor platforms cannot overlap rooms on the same floor. Shared boundaries are allowed.",
          ),
        );
      if (previous.some((other) => platformPolygonsOverlap(polygon, other)))
        issues.push(
          issue(
            "platform.overlap",
            `${p}.polygon`,
            "Outdoor platforms cannot overlap on the same floor.",
          ),
        );
      if (
        Array.isArray(floor.pools) &&
        floor.pools.some(
          (pool) =>
            isObject(pool) &&
            isOutdoorPlatformOutline(pool.polygon) &&
            platformPolygonsOverlap(polygon, pool.polygon),
        )
      )
        issues.push(
          issue(
            "platform.pool-overlap",
            `${p}.polygon`,
            "Outdoor platforms cannot overlap pool basins.",
          ),
        );
      previous.push(polygon);
    }
    return issues;
  });
}
