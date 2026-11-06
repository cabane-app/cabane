import { buildGraph, traverseFaces } from "./topology-graph";
import { normalizeWallRuns } from "./topology-wall-runs";
import type { WallNicheSpec } from "../../types";
import type { FloorEditorDraft } from "./draft-contract";
import type { EditorOpening } from "./topology-contract";

/** Niche editing shares opening gestures; persistent recesses remain wall-owned. */
export interface EditorNiche {
  kind: "niche";
  id: string;
  wallId: string;
  offsetPlanUnits: number;
  widthPlanUnits: number;
  openingHeightMeters: number;
  sillHeightMeters: number;
  side: WallNicheSpec["side"];
  depthMeters: number;
  shelfHeightsMeters?: readonly number[];
  shelfThicknessMeters?: number;
}
export type EditorWallAttachment = EditorOpening | EditorNiche;

export function editorWallAttachments(
  draft: Pick<FloorEditorDraft, "walls" | "openings">,
): EditorWallAttachment[] {
  return [
    ...draft.openings,
    ...draft.walls.flatMap((wall) =>
      (wall.niches ?? []).map((niche): EditorNiche => ({
        kind: "niche",
        id: niche.id,
        wallId: wall.id,
        offsetPlanUnits: niche.offsetFromWallStartPlanUnits,
        widthPlanUnits: niche.widthPlanUnits,
        openingHeightMeters: niche.heightMeters,
        sillHeightMeters: niche.bottomMeters,
        side: niche.side,
        depthMeters: niche.depthMeters,
        ...(niche.shelfHeightsMeters ? { shelfHeightsMeters: niche.shelfHeightsMeters } : {}),
        ...(niche.shelfThicknessMeters !== undefined
          ? { shelfThicknessMeters: niche.shelfThicknessMeters }
          : {}),
      })),
    ),
  ];
}

export function nicheDepthLimit(draft: FloorEditorDraft, wallId: string): number {
  const wall = draft.walls.find((wall) => wall.id === wallId);
  if (!wall) return 0;
  if (wall.thicknessMeters !== undefined) return Math.max(0, wall.thicknessMeters - 0.02);
  const { nodes, subsegments } = buildGraph(draft.walls, []);
  const { edgeFace } = traverseFaces(nodes, subsegments);
  const { runs } = normalizeWallRuns(
    draft.walls,
    subsegments,
    edgeFace,
    draft.slopedCeilings?.map((ceiling) => ceiling.id),
  );
  const thicknesses = runs
    .filter((run) => run.sourceWallId === wallId)
    .map((run) =>
      run.classification === "exterior"
        ? draft.exteriorWallThicknessMeters
        : draft.interiorWallThicknessMeters,
    );
  const thickness = thicknesses.length
    ? Math.min(...thicknesses)
    : draft.interiorWallThicknessMeters;
  return Math.max(0, thickness - 0.02);
}

export function wallNicheFromAttachment(niche: EditorNiche): WallNicheSpec {
  return {
    id: niche.id,
    side: niche.side,
    offsetFromWallStartPlanUnits: niche.offsetPlanUnits,
    widthPlanUnits: niche.widthPlanUnits,
    bottomMeters: niche.sillHeightMeters,
    heightMeters: niche.openingHeightMeters,
    depthMeters: niche.depthMeters,
    ...(niche.shelfHeightsMeters ? { shelfHeightsMeters: niche.shelfHeightsMeters } : {}),
    ...(niche.shelfThicknessMeters !== undefined
      ? { shelfThicknessMeters: niche.shelfThicknessMeters }
      : {}),
  };
}
