import type { WallSpec, WallJunctionSpec } from "./types";

type ClearanceWall = Pick<WallSpec, "id" | "from" | "to" | "thicknessMeters"> & {
  heightMeters?: unknown;
  virtual?: unknown;
};
const JUNCTION_EPSILON = 1e-6;

// Door and window casings can legitimately finish slightly into the nominal
// junction footprint. Keep the structural arm protected while tolerating a
// small finish overlap so near-corner openings do not fail on harmless trim.
const OPENING_JUNCTION_FINISH_TOLERANCE_METERS = 0.02;

export const junctionOccupiedIntervalsForWall = (
  wall: ClearanceWall,
  junction: Pick<WallJunctionSpec, "at">,
  incidentWalls: readonly ClearanceWall[],
  metersPerPlanUnit: number,
  defaultWallHeightMeters: number,
) => {
  if (wall.virtual === true) return [];
  const wallLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
  const wallDx = (wall.to[0] - wall.from[0]) / wallLength;
  const wallDy = (wall.to[1] - wall.from[1]) / wallLength;
  return incidentWalls
    .filter((candidate) => candidate.id !== wall.id && candidate.virtual !== true)
    .flatMap((candidate) => {
      const candidateLength = Math.hypot(
        candidate.to[0] - candidate.from[0],
        candidate.to[1] - candidate.from[1],
      );
      const candidateDx = (candidate.to[0] - candidate.from[0]) / candidateLength;
      const candidateDy = (candidate.to[1] - candidate.from[1]) / candidateLength;
      const sine = Math.abs(wallDx * candidateDy - wallDy * candidateDx);
      if (sine <= JUNCTION_EPSILON) return [];
      const halfSpan = candidate.thicknessMeters / (2 * metersPerPlanUnit * sine);
      let start = -halfSpan;
      let end = halfSpan;
      // Intersect the wall centerline with the finite adjoining wall, not its
      // infinite supporting strip. A nearly straight continuation points away
      // from this wall and must not reserve metres of space towards its doors.
      const cosine = wallDx * candidateDx + wallDy * candidateDy;
      if (Math.abs(cosine) > JUNCTION_EPSILON) {
        const junctionAlongCandidate =
          (junction.at[0] - candidate.from[0]) * candidateDx +
          (junction.at[1] - candidate.from[1]) * candidateDy;
        const from = -junctionAlongCandidate / cosine;
        const to = (candidateLength - junctionAlongCandidate) / cosine;
        start = Math.max(start, Math.min(from, to));
        end = Math.min(end, Math.max(from, to));
      }
      const tolerance = OPENING_JUNCTION_FINISH_TOLERANCE_METERS / metersPerPlanUnit;
      start += tolerance;
      end -= tolerance;
      return end > start
        ? [
            {
              start,
              end,
              topMeters:
                typeof candidate.heightMeters === "number"
                  ? candidate.heightMeters
                  : defaultWallHeightMeters,
            },
          ]
        : [];
    });
};
