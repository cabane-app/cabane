/*
 * Planar face traversal follows the conventional directed half-edge walk used
 * by OpenPlan3D and ai_room_planner (MIT). The implementation is original to
 * Cabane and keeps the data model independent from either application.
 */

import {
  DerivedWallRun,
  EditorWall,
  FLOOR_EDITOR_EPSILON,
  RemappedWallOffset,
  Subsegment,
} from "./topology-contract";
import { length, progressOnWall, round } from "./topology-plan-math";

export const remapWallOffsetToDerivedRun = (
  wallRuns: readonly DerivedWallRun[],
  sourceWallId: string,
  offsetFromWallStartPlanUnits: number,
): RemappedWallOffset | undefined => {
  const candidates = wallRuns.filter((run) => run.sourceWallId === sourceWallId);
  const run = candidates.find(
    (candidate, index) =>
      offsetFromWallStartPlanUnits >= candidate.startOffsetPlanUnits - FLOOR_EDITOR_EPSILON &&
      (offsetFromWallStartPlanUnits < candidate.endOffsetPlanUnits - FLOOR_EDITOR_EPSILON ||
        index === candidates.length - 1),
  );
  return run
    ? {
        wallId: run.wallId,
        offsetFromWallStartPlanUnits: round(
          offsetFromWallStartPlanUnits - run.startOffsetPlanUnits,
        ),
      }
    : undefined;
};

interface NormalizedWallRun extends DerivedWallRun {
  wall: EditorWall;
}

export const normalizeWallRuns = (
  walls: readonly EditorWall[],
  subsegments: readonly Subsegment[],
  edgeFace: ReadonlyMap<string, number>,
  occupiedIds: readonly string[] = [],
) => {
  const reservedIds = new Set([...occupiedIds, ...walls.map((wall) => wall.id)]);
  const classifications: Record<string, "interior" | "exterior"> = {};
  const runs: NormalizedWallRun[] = [];
  walls.forEach((sourceWall) => {
    const segments = subsegments.filter((segment) => segment.wallId === sourceWall.id);
    const classified = segments.map((segment) => {
      const forward = edgeFace.get(`${segment.id}:forward`);
      const reverse = edgeFace.get(`${segment.id}:reverse`);
      const faceCount =
        forward !== undefined && reverse !== undefined && forward === reverse
          ? 0
          : new Set([forward, reverse].filter((value) => value !== undefined)).size;
      return {
        segment,
        classification: faceCount === 2 ? ("interior" as const) : ("exterior" as const),
      };
    });
    const grouped = classified.reduce<Array<typeof classified>>((result, candidate) => {
      const current = result.at(-1);
      if (!current || current[0].classification !== candidate.classification)
        result.push([candidate]);
      else current.push(candidate);
      return result;
    }, []);
    grouped.forEach((group, runIndex) => {
      const first = group[0].segment;
      const last = group.at(-1)!.segment;
      const startOffsetPlanUnits = round(
        progressOnWall(first.from.point, sourceWall) * length(sourceWall),
      );
      const endOffsetPlanUnits = round(
        progressOnWall(last.to.point, sourceWall) * length(sourceWall),
      );
      let wallId = sourceWall.id;
      if (runIndex > 0) {
        const base = `${sourceWall.id}--split-${runIndex + 1}`;
        wallId = base;
        let collisionSerial = 2;
        while (reservedIds.has(wallId)) {
          wallId = `${base}-${collisionSerial}`;
          collisionSerial += 1;
        }
        reservedIds.add(wallId);
      }
      const classification = group[0].classification;
      classifications[wallId] = classification;
      runs.push({
        sourceWallId: sourceWall.id,
        wallId,
        startOffsetPlanUnits,
        endOffsetPlanUnits,
        classification,
        wall: {
          ...sourceWall,
          ...(sourceWall.niches
            ? {
                niches: sourceWall.niches
                  .filter(
                    (niche) =>
                      niche.offsetFromWallStartPlanUnits >=
                        startOffsetPlanUnits - FLOOR_EDITOR_EPSILON &&
                      niche.offsetFromWallStartPlanUnits <
                        endOffsetPlanUnits - FLOOR_EDITOR_EPSILON,
                  )
                  .map((niche) => ({
                    ...niche,
                    offsetFromWallStartPlanUnits: round(
                      niche.offsetFromWallStartPlanUnits - startOffsetPlanUnits,
                    ),
                  })),
              }
            : {}),
          id: wallId,
          from: first.from.point,
          to: last.to.point,
        },
      });
    });
  });
  return { runs, classifications };
};
