/* Interaction concepts were reviewed against ai_room_planner (MIT); this
 * reducer and metre-first state contract are original to Cabane. */

import { editorWallAttachments, type EditorWallAttachment } from "./wall-attachments";
import { junctionOccupiedIntervalsForWall } from "../../opening-junction-clearance";
import { buildGraph, traverseFaces } from "./topology-graph";
import { normalizeWallRuns } from "./topology-wall-runs";
import { deriveJunctions } from "./topology-junctions";
import { FloorEditorDraft } from "./draft-contract";

export const availableOpeningOffsetRanges = ({
  draft,
  wallId,
  widthPlanUnits,
  excludeOpeningId,
  gapPlanUnits,
  sillHeightMeters = 0,
  kind,
}: {
  draft: FloorEditorDraft;
  wallId: string;
  widthPlanUnits: number;
  excludeOpeningId?: string;
  gapPlanUnits?: number;
  sillHeightMeters?: number;
  kind?: EditorWallAttachment["kind"];
}) => {
  const resolvedGapPlanUnits = gapPlanUnits ?? 0.08 / draft.coordinates.metersPerPlanUnit;
  const wall = draft.walls.find((candidate) => candidate.id === wallId);
  if (!wall || wall.virtual === true) return [];
  const wallLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
  const attachments = editorWallAttachments(draft);
  const occupied = attachments
    .filter((opening) => opening.wallId === wallId && opening.id !== excludeOpeningId)
    .map((opening) => ({
      start: opening.offsetPlanUnits - resolvedGapPlanUnits,
      end: opening.offsetPlanUnits + opening.widthPlanUnits + resolvedGapPlanUnits,
    }));
  const { nodes, subsegments } = buildGraph(draft.walls, []);
  const { edgeFace } = traverseFaces(nodes, subsegments);
  const { runs } = normalizeWallRuns(draft.walls, subsegments, edgeFace);
  const walls = runs.map(({ wall, classification }) => ({
    ...wall,
    thicknessMeters:
      wall.thicknessMeters ??
      (classification === "interior"
        ? draft.interiorWallThicknessMeters
        : draft.exteriorWallThicknessMeters),
  }));
  const isNiche =
    kind === "niche" ||
    attachments.some(
      (attachment) => attachment.id === excludeOpeningId && attachment.kind === "niche",
    );
  const clearance = isNiche
    ? (Math.max(
        0,
        ...walls
          .filter((owner) =>
            runs.some((run) => run.wallId === owner.id && run.sourceWallId === wallId),
          )
          .map((owner) => owner.thicknessMeters),
      ) /
        2 +
        0.002) /
      draft.coordinates.metersPerPlanUnit
    : 0;
  const junctions = deriveJunctions(walls, nodes, draft.junctions);
  for (const run of runs.filter((run) => run.sourceWallId === wallId)) {
    const owner = walls.find((wall) => wall.id === run.wallId)!;
    const length = Math.hypot(owner.to[0] - owner.from[0], owner.to[1] - owner.from[1]);
    for (const junction of junctions.filter((junction) => junction.wallIds.includes(owner.id))) {
      const distance =
        ((junction.at[0] - owner.from[0]) * (owner.to[0] - owner.from[0]) +
          (junction.at[1] - owner.from[1]) * (owner.to[1] - owner.from[1])) /
        length;
      const intervals = junctionOccupiedIntervalsForWall(
        owner,
        junction,
        walls.filter((wall) => junction.wallIds.includes(wall.id)),
        draft.coordinates.metersPerPlanUnit,
        draft.defaultWallHeightMeters,
      );
      occupied.push(
        ...intervals
          .filter(({ topMeters }) => topMeters > sillHeightMeters + 1e-6)
          .map(({ start, end }) => ({
            start: Math.max(0, start + distance + run.startOffsetPlanUnits),
            end: Math.min(wallLength, end + distance + run.startOffsetPlanUnits),
          }))
          .filter(({ start, end }) => end > start),
      );
    }
  }
  occupied.sort((left, right) => left.start - right.start);
  const ranges: Array<{ min: number; max: number }> = [];
  let cursor = clearance;
  for (const interval of occupied) {
    const max = Math.min(interval.start, wallLength - clearance) - widthPlanUnits;
    if (max >= cursor) ranges.push({ min: cursor, max });
    cursor = Math.max(cursor, interval.end);
  }
  const finalMax = wallLength - clearance - widthPlanUnits;
  if (finalMax >= cursor) ranges.push({ min: cursor, max: finalMax });
  return ranges;
};

export const nearestAvailableOpeningOffset = (
  requested: number,
  ranges: readonly { min: number; max: number }[],
) =>
  ranges
    .map((range) => Math.max(range.min, Math.min(range.max, requested)))
    .sort((left, right) => Math.abs(left - requested) - Math.abs(right - requested))[0];

export const duplicateOpeningOffset = (draft: FloorEditorDraft, openingId: string) => {
  const source = editorWallAttachments(draft).find((opening) => opening.id === openingId);
  if (!source) return undefined;
  return nearestAvailableOpeningOffset(
    source.offsetPlanUnits,
    availableOpeningOffsetRanges({
      draft,
      wallId: source.wallId,
      widthPlanUnits: source.widthPlanUnits,
      sillHeightMeters: source.sillHeightMeters,
      kind: source.kind,
    }),
  );
};
