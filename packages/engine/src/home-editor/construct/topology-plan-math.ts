/*
 * Planar face traversal follows the conventional directed half-edge walk used
 * by OpenPlan3D and ai_room_planner (MIT). The implementation is original to
 * Cabane and keeps the data model independent from either application.
 */

import { pointInsidePolygon } from "../../geometry";

import type { ManifestIssue, PlanPoint, Polygon } from "../../types";
import { EditorWall, FLOOR_EDITOR_EPSILON } from "./topology-contract";

export const round = (value: number) =>
  Math.abs(value) < FLOOR_EDITOR_EPSILON ? 0 : Number(value.toFixed(8));

export const point = (x: number, y: number): PlanPoint => [round(x), round(y)];

export const pointKey = (value: PlanPoint) => `${round(value[0])},${round(value[1])}`;

export const samePoint = (left: PlanPoint, right: PlanPoint) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= FLOOR_EDITOR_EPSILON;

export const cross = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

export const length = (wall: Pick<EditorWall, "from" | "to">) =>
  Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);

export const pointOnSegment = (candidate: PlanPoint, wall: Pick<EditorWall, "from" | "to">) => {
  if (
    Math.abs(cross(wall.from, wall.to, candidate)) >
    FLOOR_EDITOR_EPSILON * Math.max(1, length(wall))
  )
    return false;
  return (
    candidate[0] >= Math.min(wall.from[0], wall.to[0]) - FLOOR_EDITOR_EPSILON &&
    candidate[0] <= Math.max(wall.from[0], wall.to[0]) + FLOOR_EDITOR_EPSILON &&
    candidate[1] >= Math.min(wall.from[1], wall.to[1]) - FLOOR_EDITOR_EPSILON &&
    candidate[1] <= Math.max(wall.from[1], wall.to[1]) + FLOOR_EDITOR_EPSILON
  );
};

export const progressOnWall = (candidate: PlanPoint, wall: EditorWall) => {
  const dx = wall.to[0] - wall.from[0];
  const dy = wall.to[1] - wall.from[1];
  const squared = dx * dx + dy * dy;
  return squared <= FLOOR_EDITOR_EPSILON
    ? 0
    : ((candidate[0] - wall.from[0]) * dx + (candidate[1] - wall.from[1]) * dy) / squared;
};

export const properIntersection = (left: EditorWall, right: EditorWall): PlanPoint | null => {
  const leftDx = left.to[0] - left.from[0];
  const leftDy = left.to[1] - left.from[1];
  const rightDx = right.to[0] - right.from[0];
  const rightDy = right.to[1] - right.from[1];
  const denominator = leftDx * rightDy - leftDy * rightDx;
  if (Math.abs(denominator) <= FLOOR_EDITOR_EPSILON) return null;
  const offsetX = right.from[0] - left.from[0];
  const offsetY = right.from[1] - left.from[1];
  const leftProgress = (offsetX * rightDy - offsetY * rightDx) / denominator;
  const rightProgress = (offsetX * leftDy - offsetY * leftDx) / denominator;
  if (
    leftProgress < -FLOOR_EDITOR_EPSILON ||
    leftProgress > 1 + FLOOR_EDITOR_EPSILON ||
    rightProgress < -FLOOR_EDITOR_EPSILON ||
    rightProgress > 1 + FLOOR_EDITOR_EPSILON
  )
    return null;
  return point(left.from[0] + leftDx * leftProgress, left.from[1] + leftDy * leftProgress);
};

export const collinearOverlap = (left: EditorWall, right: EditorWall) => {
  if (
    Math.abs(cross(left.from, left.to, right.from)) > FLOOR_EDITOR_EPSILON ||
    Math.abs(cross(left.from, left.to, right.to)) > FLOOR_EDITOR_EPSILON
  )
    return false;
  const values = [progressOnWall(right.from, left), progressOnWall(right.to, left)].sort(
    (a, b) => a - b,
  );
  return Math.min(1, values[1]) - Math.max(0, values[0]) > FLOOR_EDITOR_EPSILON;
};

export const centroid = (polygon: Polygon): PlanPoint => {
  let x = 0;
  let y = 0;
  let factorTotal = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const factor = current[0] * next[1] - next[0] * current[1];
    x += (current[0] + next[0]) * factor;
    y += (current[1] + next[1]) * factor;
    factorTotal += factor;
  }
  if (Math.abs(factorTotal) <= FLOOR_EDITOR_EPSILON) {
    return point(
      polygon.reduce((sum, value) => sum + value[0], 0) / polygon.length,
      polygon.reduce((sum, value) => sum + value[1], 0) / polygon.length,
    );
  }
  return point(x / (3 * factorTotal), y / (3 * factorTotal));
};

export const roomAnchorForPolygon = (polygon: Polygon): PlanPoint => {
  const center = centroid(polygon);
  if (
    pointInsidePolygon(center, polygon) &&
    !polygon.some((from, index) =>
      pointOnSegment(center, { from, to: polygon[(index + 1) % polygon.length] }),
    )
  )
    return center;

  // Between consecutive vertex heights, sorted crossings form interior pairs.
  // Their midpoints avoid edges, even when the area centroid is outside the room.
  const heights = [...new Set(polygon.map((value) => value[1]))].sort((a, b) => a - b);
  let anchor = center;
  let bestClearance = 0;
  for (let row = 1; row < heights.length; row += 1) {
    const height = heights[row] - heights[row - 1];
    const y = heights[row - 1] + height / 2;
    const crossings: number[] = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      if (a[1] > y === b[1] > y) continue;
      const [low, high] = a[1] < b[1] ? [a, b] : [b, a];
      crossings.push(low[0] + ((y - low[1]) * (high[0] - low[0])) / (high[1] - low[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let index = 1; index < crossings.length; index += 2) {
      const width = crossings[index] - crossings[index - 1];
      const clearance = Math.min(width, height);
      if (clearance <= bestClearance) continue;
      bestClearance = clearance;
      // Do not round: rounding can put a narrow room's midpoint back on an edge.
      anchor = [crossings[index - 1] + width / 2, y];
    }
  }
  return anchor;
};

export const containsPoint = (candidate: PlanPoint, polygon: Polygon) =>
  pointInsidePolygon(candidate, polygon) ||
  polygon.some((value, index) =>
    pointOnSegment(candidate, { from: value, to: polygon[(index + 1) % polygon.length] }),
  );

export const issue = (code: string, path: string, message: string): ManifestIssue => ({
  code,
  path,
  message,
  severity: "fatal",
});
