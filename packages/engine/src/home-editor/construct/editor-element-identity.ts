import type { FloorEditorDraft } from "./draft-contract";

const occupiedElementIds = (draft: FloorEditorDraft) =>
  new Set([
    draft.floorId,
    ...draft.walls.map((wall) => wall.id),
    ...draft.openings.map((opening) => opening.id),
    ...draft.walls.flatMap((wall) => (wall.niches ?? []).map((niche) => niche.id)),
    ...draft.rooms.flatMap((room) => [
      room.id,
      room.ceilingId,
      ...(room.floorZones ?? []).map((zone) => zone.id),
    ]),
    ...(draft.slopedCeilings ?? []).map((ceiling) => ceiling.id),
    ...draft.junctions.map((junction) => junction.id),
    ...(draft.hedges ?? []).map((hedge) => hedge.id),
    ...(draft.outdoorPlatforms ?? []).flatMap((platform) => [
      platform.id,
      ...platform.edges.map((edge) => edge.id),
    ]),
    ...(draft.pools ?? []).map((pool) => pool.id),
    ...(draft.groundZones ?? []).map((zone) => zone.id),
  ]);

export const unusedElementSerial = (draft: FloorEditorDraft, prefix: string) => {
  const occupied = occupiedElementIds(draft);
  let serial = draft.nextSerial;
  // Recovery and deletion can make collection counts smaller than existing IDs.
  while (occupied.has(`${draft.floorId}:${prefix}-${serial}`)) serial += 1;
  return serial;
};

export const unusedElementId = (draft: FloorEditorDraft, preferred: string) => {
  const occupied = occupiedElementIds(draft);
  if (!occupied.has(preferred)) return preferred;
  let suffix = 2;
  while (occupied.has(`${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
};
