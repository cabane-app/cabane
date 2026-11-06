import type { FloorEditorDraft, FloorEditorSelectionTarget } from "./draft-contract";
import type { PlanPoint } from "../../types";

/** Trim source geometry and rehome supported openings as one history operation. */
export function deleteWallSpans(
  draft: FloorEditorDraft,
  targets: readonly FloorEditorSelectionTarget[],
) {
  const occupied = new Set(
    [
      ...draft.walls,
      ...draft.walls.flatMap((wall) => wall.niches ?? []),
      ...draft.openings,
      ...draft.rooms,
      ...(draft.slopedCeilings ?? []),
      ...draft.junctions,
      ...(draft.hedges ?? []),
      ...(draft.pools ?? []),
      ...(draft.groundZones ?? []),
      ...draft.rooms.flatMap((room) => room.floorZones ?? []),
    ].map((item) => item.id),
  );
  occupied.add(draft.floorId);
  for (const room of draft.rooms) if (room.ceilingId) occupied.add(room.ceilingId);
  const pieces = draft.walls.flatMap((wall) => {
    const cuts = targets
      .flatMap((t) => (t.kind === "wall" && t.id === wall.id ? [t.span ?? ([0, 1] as const)] : []))
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    const retained: [number, number][] = [];
    for (const [start, end] of cuts) {
      if (start > cursor + 1e-7) retained.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1 - 1e-7) retained.push([cursor, 1]);
    return retained.map(([start, end], index) => {
      let id = wall.id;
      if (index) {
        let serial = index;
        while (occupied.has(`${wall.id}:retained-${serial}`)) serial++;
        id = `${wall.id}:retained-${serial}`;
        occupied.add(id);
      }
      const at = (t: number): PlanPoint => [
        wall.from[0] + (wall.to[0] - wall.from[0]) * t,
        wall.from[1] + (wall.to[1] - wall.from[1]) * t,
      ];
      const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
      const niches = wall.niches
        ?.filter(
          (niche) =>
            !targets.some((t) => t.kind === "opening" && t.id === niche.id) &&
            niche.offsetFromWallStartPlanUnits >= start * length - 1e-7 &&
            niche.offsetFromWallStartPlanUnits + niche.widthPlanUnits <= end * length + 1e-7,
        )
        .map((niche) => ({
          ...niche,
          offsetFromWallStartPlanUnits: niche.offsetFromWallStartPlanUnits - start * length,
        }));
      return {
        source: wall,
        start,
        end,
        wall:
          start === 0 && end === 1 && niches?.length === wall.niches?.length
            ? wall
            : { ...wall, ...(niches ? { niches } : {}), id, from: at(start), to: at(end) },
      };
    });
  });
  const openings = draft.openings.flatMap((opening) => {
    if (targets.some((t) => t.kind === "opening" && t.id === opening.id)) return [];
    const piece = pieces.find((p) => {
      const length = Math.hypot(
        p.source.to[0] - p.source.from[0],
        p.source.to[1] - p.source.from[1],
      );
      return (
        p.source.id === opening.wallId &&
        opening.offsetPlanUnits >= p.start * length - 1e-7 &&
        opening.offsetPlanUnits + opening.widthPlanUnits <= p.end * length + 1e-7
      );
    });
    if (!piece) return [];
    const length = Math.hypot(
      piece.source.to[0] - piece.source.from[0],
      piece.source.to[1] - piece.source.from[1],
    );
    return [
      {
        ...opening,
        wallId: piece.wall.id,
        offsetPlanUnits: opening.offsetPlanUnits - piece.start * length,
      },
    ];
  });
  const junctions = draft.junctions.flatMap((junction) => {
    const wallIds = pieces
      .filter((p) => {
        if (!junction.wallIds.includes(p.source.id)) return false;
        const dx = p.wall.to[0] - p.wall.from[0],
          dy = p.wall.to[1] - p.wall.from[1];
        const t =
          ((junction.at[0] - p.wall.from[0]) * dx + (junction.at[1] - p.wall.from[1]) * dy) /
          (dx * dx + dy * dy);
        return t >= -1e-7 && t <= 1 + 1e-7;
      })
      .map((p) => p.wall.id);
    return wallIds.length < 2
      ? []
      : [{ ...junction, wallIds: wallIds as [string, string, ...string[]] }];
  });
  return { walls: pieces.map((p) => p.wall), openings, junctions };
}
