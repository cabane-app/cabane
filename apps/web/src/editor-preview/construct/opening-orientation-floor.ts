import type { EditorOpening, FloorEditorDraft, FloorSpec } from "@cabane/engine";

const withoutOrientation = (opening: EditorOpening) => {
  if (opening.kind === "passage") return opening;
  const { hingeSide: _hinge, openingSide: _side, ...rest } = opening;
  const { slideDirection: _slide, ...door } = rest;
  return door;
};

/** Surface, pool, and opening-orientation edits must not reconstruct accepted rooms or walls. */
export function floorWithOpeningOrientations(
  before: FloorEditorDraft,
  after: FloorEditorDraft,
  floor: FloorSpec,
): FloorSpec | null {
  if (!floor.rooms.length && before.outdoorPlatforms !== after.outdoorPlatforms) return null;
  const architectureKeys = [
    "walls",
    "rooms",
    "junctions",
    "coordinates",
    "floorId",
    "floorName",
    "defaultWallHeightMeters",
    "defaultCeilingHeightMeters",
    "exteriorWallThicknessMeters",
    "interiorWallThicknessMeters",
  ] as const;
  if (
    architectureKeys.some((key) => before[key] !== after[key]) ||
    before.openings.length !== after.openings.length
  )
    return null;
  if (
    before.openings.some(
      (opening, index) =>
        opening !== after.openings[index] &&
        JSON.stringify(withoutOrientation(opening)) !==
          JSON.stringify(withoutOrientation(after.openings[index])),
    )
  )
    return null;
  const changed = new Map(
    after.openings
      .filter((opening, index) => opening !== before.openings[index])
      .map((opening) => [opening.id, opening]),
  );
  let nextFloor: FloorSpec =
    before.pools === after.pools ? floor : { ...floor, pools: after.pools ?? [] };
  if (before.outdoorPlatforms !== after.outdoorPlatforms)
    nextFloor = { ...nextFloor, outdoorPlatforms: after.outdoorPlatforms ?? [] };
  if (before.hedges !== after.hedges) nextFloor = { ...nextFloor, hedges: after.hedges ?? [] };
  if (before.groundZones !== after.groundZones) {
    nextFloor = { ...nextFloor, groundZones: after.groundZones ?? [] };
  }
  if (!changed.size) return nextFloor;
  return {
    ...nextFloor,
    openings: floor.openings.map((opening) => {
      const next = changed.get(opening.id);
      if (
        !next ||
        next.kind === "passage" ||
        opening.kind === "passage" ||
        next.kind !== opening.kind
      )
        return opening;
      const base = { ...opening };
      delete base.hingeSide;
      delete base.openingSide;
      delete base.slideDirection;
      const side = next.openingSide !== undefined ? { openingSide: next.openingSide } : {};
      if (base.kind === "door" && next.kind === "door") {
        if (
          (base.operation === "hinged" && next.operation === "hinged") ||
          (base.operation === "bifold" && next.operation === "bifold")
        )
          return {
            ...base,
            ...side,
            ...(next.hingeSide !== undefined ? { hingeSide: next.hingeSide } : {}),
          };
        if (base.operation === "sliding" && next.operation === "sliding")
          return {
            ...base,
            ...side,
            ...(next.slideDirection !== undefined ? { slideDirection: next.slideDirection } : {}),
          };
        if (base.operation === "roll-up" && next.operation === "roll-up")
          return { ...base, ...side };
      }
      if (base.kind === "window" && next.kind === "window")
        return {
          ...base,
          ...side,
          ...(next.hingeSide !== undefined ? { hingeSide: next.hingeSide } : {}),
          ...(next.slideDirection !== undefined ? { slideDirection: next.slideDirection } : {}),
        };
      return opening;
    }),
  };
}
