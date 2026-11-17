import { elevationWithPolygon } from "../../elevation/surfaces";
import type { FloorEditorAction, FloorEditorDraft } from "./draft-contract";

export function updateFloorZone(
  draft: FloorEditorDraft,
  action: Extract<FloorEditorAction, { type: "update-floor-zone" }>,
): FloorEditorDraft {
  const groundZone = draft.groundZones?.find((zone) => zone.id === action.zoneId);
  if (groundZone) {
    const groundZones = draft.groundZones!.map((zone) =>
      zone.id === action.zoneId
        ? {
            ...zone,
            ...action.changes,
            ...(zone.elevation && action.changes.polygon && !action.changes.elevation
              ? {
                  elevation: elevationWithPolygon(
                    zone.elevation,
                    zone.polygon,
                    action.changes.polygon,
                  ),
                }
              : {}),
          }
        : zone,
    );
    if (JSON.stringify(groundZones) === JSON.stringify(draft.groundZones)) {
      return draft;
    }
    return { ...draft, groundZones };
  }
  const owner = draft.rooms.find((room) =>
    room.floorZones?.some((zone) => zone.id === action.zoneId),
  );
  if (!owner) return draft;
  const floorZones = owner.floorZones!.map((zone) =>
    zone.id === action.zoneId
      ? {
          ...zone,
          ...action.changes,
          ...(zone.elevation && action.changes.polygon && !action.changes.elevation
            ? {
                elevation: elevationWithPolygon(
                  zone.elevation,
                  zone.polygon,
                  action.changes.polygon,
                ),
              }
            : {}),
        }
      : zone,
  );
  if (JSON.stringify(floorZones) === JSON.stringify(owner.floorZones)) {
    return draft;
  }
  return {
    ...draft,
    rooms: draft.rooms.map((room) => (room.id === owner.id ? { ...room, floorZones } : room)),
  };
}
