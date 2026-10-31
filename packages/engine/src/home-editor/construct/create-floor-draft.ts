/* Interaction concepts were reviewed against ai_room_planner (MIT); this
 * reducer and metre-first state contract are original to Cabane. */
import { indoorRoomsForFloor } from "../../outdoor-platforms/platform-rooms";
import type { FloorSpec, Polygon } from "../../types";

import { mapPoolOutline } from "../../pools/pool-footprint";

import { FLOOR_EDITOR_DRAFT_VERSION, FloorEditorDraft } from "./draft-contract";
import { roomAnchorForPolygon } from "./topology";

export const createFloorEditorDraft = (floor: FloorSpec): FloorEditorDraft => ({
  version: FLOOR_EDITOR_DRAFT_VERSION,
  floorId: floor.id,
  floorToFloorHeightMeters: floor.floorToFloorHeightMeters,
  ...(floor.belowGround !== undefined ? { belowGround: floor.belowGround } : {}),
  floorName: floor.name,
  ...(floor.hedges ? { hedges: floor.hedges.map((hedge) => ({ ...hedge })) } : {}),
  ...(floor.outdoorPlatforms
    ? {
        outdoorPlatforms: structuredClone(
          floor.outdoorPlatforms,
        ) as import("../../types").OutdoorPlatformSpec[],
      }
    : {}),
  ...(floor.pools
    ? {
        pools: floor.pools.map((pool) => ({
          ...pool,
          polygon: mapPoolOutline(pool.polygon, (point) => [...point]),
        })),
      }
    : {}),
  ...(floor.groundZones
    ? {
        groundZones: floor.groundZones.map((zone) => ({
          ...zone,
          polygon: zone.polygon.map((point) => [...point]) as unknown as Polygon,
          finish: { ...zone.finish },
        })),
      }
    : {}),
  coordinates: {
    origin: [...floor.coordinates.origin],
    metersPerPlanUnit: floor.coordinates.metersPerPlanUnit,
    scaleBasis: floor.coordinates.scaleBasis,
  },
  walls: floor.walls.map((wall) => ({
    id: wall.id,
    ...(wall.name ? { name: wall.name } : {}),
    from: [...wall.from],
    to: [...wall.to],
    thicknessMeters: wall.thicknessMeters,
    ...(wall.virtual ? { virtual: true } : {}),
    ...(wall.heightMeters ? { heightMeters: wall.heightMeters } : {}),
    ...(wall.exteriorColor ? { exteriorColor: wall.exteriorColor } : {}),
    ...(wall.edgeColor ? { edgeColor: wall.edgeColor } : {}),
    ...(wall.faceColors ? { faceColors: { ...wall.faceColors } } : {}),
    ...(wall.niches ? { niches: wall.niches.map((niche) => ({ ...niche })) } : {}),
  })),
  openings: floor.openings.map((opening) => {
    const shared = {
      id: opening.id,
      ...(opening.name ? { name: opening.name } : {}),
      wallId: opening.wallId,
      offsetPlanUnits: opening.offsetFromWallStartPlanUnits,
      widthPlanUnits: opening.widthPlanUnits,
      openingHeightMeters: opening.openingHeightMeters,
      sillHeightMeters: opening.sillHeightMeters,
    };
    if (opening.kind === "door") {
      const {
        offsetFromWallStartPlanUnits: _offset,
        contactSlot: _contact,
        coverSlot: _cover,
        visualModel: _model,
        ...design
      } = opening;
      return { ...design, ...shared };
    }
    if (opening.kind === "window")
      return {
        ...shared,
        kind: "window" as const,
        operation: opening.operation,
        variant: opening.variant,
        panelCount: opening.panelCount,
        ...(opening.hingeSide !== undefined ? { hingeSide: opening.hingeSide } : {}),
        ...(opening.openingSide !== undefined ? { openingSide: opening.openingSide } : {}),
        glazing: opening.glazing,
        ...(opening.color !== undefined ? { color: opening.color } : {}),
        ...(opening.muntins ? { muntins: { ...opening.muntins } } : {}),
      };
    return opening.variant === "arched"
      ? {
          ...shared,
          kind: "passage" as const,
          variant: "arched" as const,
          archRiseMeters: opening.archRiseMeters,
        }
      : { ...shared, kind: "passage" as const, variant: "rectangular" as const };
  }),
  rooms: indoorRoomsForFloor(floor).map((room) => {
    const ceiling = floor.ceilings?.find(
      (candidate) => candidate.kind === "flat" && candidate.roomIds.includes(room.id),
    );
    return {
      id: room.id,
      ...(room.isSolid !== undefined ? { isSolid: room.isSolid } : {}),
      name: room.name,
      accent: room.accent,
      ...(room.floorFinish
        ? {
            floorFinish: { ...room.floorFinish },
          }
        : {}),
      ...(room.floorZones
        ? {
            floorZones: room.floorZones.map((zone) => ({
              ...zone,
              polygon: zone.polygon.map((point) => [...point]) as unknown as Polygon,
              finish: { ...zone.finish },
            })),
          }
        : {}),
      ...(ceiling?.kind === "flat"
        ? {
            ceilingId: ceiling.id,
            ceilingHeightMeters: ceiling.heightMeters,
          }
        : {}),
      anchor: roomAnchorForPolygon(room.polygon),
    };
  }),
  junctions: floor.wallJunctions.map((junction) => ({
    ...junction,
    at: [...junction.at],
    wallIds: [...junction.wallIds] as [string, string, ...string[]],
  })),
  defaultWallHeightMeters: floor.defaultWallHeightMeters,
  defaultCeilingHeightMeters: floor.defaultCeilingHeightMeters,
  exteriorWallThicknessMeters:
    floor.walls.find((wall) => wall.classification === "exterior")?.thicknessMeters ?? 0.2,
  interiorWallThicknessMeters:
    floor.walls.find((wall) => wall.classification === "interior")?.thicknessMeters ?? 0.12,
  tool: "select",
  selection: null,
  view: {
    center:
      floor.footprint.length >= 3
        ? roomAnchorForPolygon(floor.footprint as Polygon)
        : floor.coordinates.origin,
    pixelsPerMeter: 82,
  },
  nextSerial: floor.walls.length + floor.openings.length + floor.rooms.length + 1,
});
