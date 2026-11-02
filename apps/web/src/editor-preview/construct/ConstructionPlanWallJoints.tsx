import { planPointToWorld, type FloorEditorDraft } from "@cabane/engine";
import { memo, useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { noPlanRaycast, PlanMaterial } from "./PlanDrawing";

type Point = readonly [number, number];
const EPSILON = 1e-7;
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

/** Fill only the outside sector of adjoining butt-ended bands. No mesh unions,
 * topology rebuilds, or changes to free ends and wall-owned opening gaps. */
function jointTriangles(draft: FloorEditorDraft): number[] {
  const scale = draft.coordinates.metersPerPlanUnit;
  const walls = draft.walls.flatMap((wall) => {
    if (wall.virtual) return [];
    const from = planPointToWorld(wall.from, draft.coordinates);
    const to = planPointToWorld(wall.to, draft.coordinates);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < EPSILON) return [];
    return [
      {
        from,
        to,
        length,
        direction: [(to[0] - from[0]) / length, (to[1] - from[1]) / length] as Point,
        halfWidth: (wall.thicknessMeters ?? draft.interiorWallThicknessMeters) / 2,
        gaps: draft.openings
          .filter((opening) => opening.wallId === wall.id)
          .map(
            (opening) =>
              [
                opening.offsetPlanUnits * scale,
                (opening.offsetPlanUnits + opening.widthPlanUnits) * scale,
              ] as const,
          ),
      },
    ];
  });
  const corners: Point[] = [];
  for (const point of walls.flatMap((wall) => [wall.from, wall.to])) {
    if (!corners.some((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) < EPSILON))
      corners.push(point);
  }
  const triangles: number[] = [];
  for (const center of corners) {
    const arms = walls
      .flatMap((wall) => {
        const offset: Point = [center[0] - wall.from[0], center[1] - wall.from[1]];
        const along = offset[0] * wall.direction[0] + offset[1] * wall.direction[1];
        if (
          Math.abs(cross(offset, wall.direction)) > EPSILON ||
          along < -EPSILON ||
          along > wall.length + EPSILON
        )
          return [];
        return [1, -1].flatMap((sign) => {
          const probe = along + sign * EPSILON;
          if (
            probe < 0 ||
            probe > wall.length ||
            wall.gaps.some(([start, end]) => probe > start && probe < end)
          )
            return [];
          const direction: Point = [wall.direction[0] * sign, wall.direction[1] * sign];
          return [
            { direction, halfWidth: wall.halfWidth, angle: Math.atan2(direction[1], direction[0]) },
          ];
        });
      })
      .sort((a, b) => a.angle - b.angle);
    if (arms.length < 2) continue;
    for (let index = 0; index < arms.length; index += 1) {
      const a = arms[index],
        b = arms[(index + 1) % arms.length];
      const sector = (b.angle - a.angle + Math.PI * 2) % (Math.PI * 2);
      // Interior/T/crossing sectors are already covered by the wall rectangles.
      if (sector <= Math.PI + EPSILON) continue;
      const left: Point = [-a.direction[1] * a.halfWidth, a.direction[0] * a.halfWidth];
      const right: Point = [b.direction[1] * b.halfWidth, -b.direction[0] * b.halfWidth];
      const denominator = cross(a.direction, b.direction);
      const polygon: Point[] = [[0, 0], left];
      if (Math.abs(denominator) > EPSILON) {
        const distance = cross([right[0] - left[0], right[1] - left[1]], b.direction) / denominator;
        const miter: Point = [
          left[0] + distance * a.direction[0],
          left[1] + distance * a.direction[1],
        ];
        // Acute draft angles use a bevel instead of a very long miter spike.
        if (Math.hypot(...miter) <= 4 * Math.max(a.halfWidth, b.halfWidth)) polygon.push(miter);
      }
      polygon.push(right);
      for (let vertex = 1; vertex < polygon.length - 1; vertex += 1) {
        for (const point of [polygon[0], polygon[vertex], polygon[vertex + 1]]) {
          triangles.push(center[0] + point[0], 0.035, center[1] + point[1]);
        }
      }
    }
  }
  return triangles;
}

export const ConstructionPlanWallJoints = memo(function ConstructionPlanWallJoints({
  draft,
}: {
  draft: FloorEditorDraft;
}) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(jointTriangles(draft), 3));
    result.computeVertexNormals();
    return result;
    // Joint geometry depends only on these architectural fields, not selection or editor metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.walls, draft.openings, draft.coordinates, draft.interiorWallThicknessMeters]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="plan-wall-joints" geometry={geometry} raycast={noPlanRaycast}>
      <PlanMaterial color="#596057" />
    </mesh>
  );
});
