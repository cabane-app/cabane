/*
 * Planar face traversal follows the conventional directed half-edge walk used
 * by OpenPlan3D and ai_room_planner (MIT). The implementation is original to
 * Cabane and keeps the data model independent from either application.
 */

import type { WallJunctionSpec } from "../../types";
import { EditorWall, Node } from "./topology-contract";
import { pointKey, pointOnSegment, samePoint } from "./topology-plan-math";

export const deriveJunctions = (
  walls: readonly EditorWall[],
  nodes: readonly Node[],
  previous: readonly WallJunctionSpec[],
  occupiedIds: readonly string[] = [],
) =>
  nodes.flatMap((node): WallJunctionSpec[] => {
    const wallIds = walls
      .filter((wall) => pointOnSegment(node.point, wall))
      .map((wall) => wall.id)
      .sort();
    if (wallIds.length < 2) return [];
    const prior = previous.find(
      (junction) =>
        samePoint(junction.at, node.point) &&
        [...junction.wallIds].sort().join("|") === wallIds.join("|"),
    );
    const base = `junction-${wallIds.join("-")}-${pointKey(node.point).replaceAll(",", "-").replaceAll(".", "_")}`;
    let id = prior?.id ?? base;
    if (!prior && occupiedIds.includes(id)) {
      let suffix = 2;
      do {
        id = `${base}-${suffix++}`;
      } while (occupiedIds.includes(id) || previous.some((junction) => junction.id === id));
    }
    return [
      {
        id,
        at: node.point,
        wallIds: wallIds as [string, string, ...string[]],
      },
    ];
  });
