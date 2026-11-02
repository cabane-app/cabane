import { addEditorWall } from "./wall-editor-actions";
import { unusedElementId, unusedElementSerial } from "./editor-element-identity";
import { constrainWallNiches, reduceNicheOpeningAction } from "./niche-editor-actions";
import {
  isOutdoorPlatformOutline,
  platformWithPolygon,
} from "../../outdoor-platforms/platform-geometry";
import { validPlatformEdgeConfiguration } from "../../outdoor-platforms/platform-barriers";
import { DEFAULT_DOOR_CONFIGURATION, doorFromConfiguration } from "../../door-configuration";
import { deleteWallSpans } from "./delete-wall-spans";
import { validHedge } from "../../hedges/hedge-validity";
/* Interaction concepts were reviewed against ai_room_planner (MIT); this
 * reducer and metre-first state contract are original to Cabane. */
import type { FloorFinishZoneSpec, PlanPoint } from "../../types";

import { isFloorZoneOutline } from "../../floor-finishes/finish-geometry";

import { isPoolOutline } from "../../pools/pool-footprint";

import { changeOpeningOrientation } from "../../opening-orientation";

import { FloorEditorAction, FloorEditorDraft, FloorEditorSelectionTarget } from "./draft-contract";
import {
  createFloorEditorSelection,
  floorEditorSelectionTargets,
  sameSelection,
} from "./draft-selection";
import { duplicateOpeningOffset } from "./opening-offsets";
import { type EditorOpening, type EditorRoomIdentity } from "./topology";

export const samePoint = (left: PlanPoint, right: PlanPoint) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= 1e-7;

export const round = (value: number) => Number(value.toFixed(4));

const moved = (value: PlanPoint, delta: PlanPoint): PlanPoint => [
  round(value[0] + delta[0]),
  round(value[1] + delta[1]),
];

const deleteElements = (
  draft: FloorEditorDraft,
  targets: readonly FloorEditorSelectionTarget[],
): FloorEditorDraft => {
  const roomIds = new Set(
    targets.filter((target) => target.kind === "room").map((target) => target.id),
  );
  const floorZoneIds = new Set(
    targets.filter((target) => target.kind === "floor-zone").map((target) => target.id),
  );
  const poolIds = new Set(
    targets.filter((target) => target.kind === "pool").map((target) => target.id),
  );
  const { walls, openings, junctions } = deleteWallSpans(draft, targets);
  const rooms = draft.rooms
    .filter((room) => !roomIds.has(room.id))
    .map((room) => ({
      ...room,
      ...(room.floorZones
        ? { floorZones: room.floorZones.filter((zone) => !floorZoneIds.has(zone.id)) }
        : {}),
    }));
  const hedges = (draft.hedges ?? []).filter(
    (hedge) => !targets.some((target) => target.kind === "hedge" && target.id === hedge.id),
  );
  const outdoorPlatforms = (draft.outdoorPlatforms ?? []).filter(
    (platform) =>
      !targets.some((target) => target.kind === "outdoor-platform" && target.id === platform.id),
  );
  const pools = (draft.pools ?? []).filter((pool) => !poolIds.has(pool.id));
  const groundZones = (draft.groundZones ?? []).filter((zone) => !floorZoneIds.has(zone.id));
  const removedFloorZone =
    groundZones.length !== (draft.groundZones ?? []).length ||
    rooms.some(
      (room) =>
        (room.floorZones?.length ?? 0) !==
        (draft.rooms.find((candidate) => candidate.id === room.id)?.floorZones?.length ?? 0),
    );
  const changed =
    outdoorPlatforms.length !== (draft.outdoorPlatforms ?? []).length ||
    hedges.length !== (draft.hedges ?? []).length ||
    walls.length !== draft.walls.length ||
    walls.some((wall, index) => wall !== draft.walls[index]) ||
    openings.length !== draft.openings.length ||
    rooms.length !== draft.rooms.length ||
    removedFloorZone ||
    pools.length !== (draft.pools ?? []).length;
  if (!changed) return draft;
  return {
    ...draft,
    walls,
    openings,
    rooms,
    junctions,
    ...(draft.hedges ? { hedges } : {}),
    ...(draft.outdoorPlatforms ? { outdoorPlatforms } : {}),
    ...(draft.pools ? { pools } : {}),
    ...(draft.groundZones ? { groundZones } : {}),
    selection: null,
  };
};

const reduceDraftAction = (
  draft: FloorEditorDraft,
  action: Exclude<FloorEditorAction, { type: "undo" | "redo" }>,
): FloorEditorDraft => {
  const nicheResult = reduceNicheOpeningAction(draft, action);
  if (nicheResult) return nicheResult;
  switch (action.type) {
    case "set-tool":
      return { ...draft, tool: action.tool, selection: null };
    case "select": {
      const selection = createFloorEditorSelection(floorEditorSelectionTargets(action.selection));
      return sameSelection(draft.selection, selection) ? draft : { ...draft, selection };
    }
    case "set-view":
      return { ...draft, view: action.view };
    case "set-floor-name":
      return { ...draft, floorName: action.name };
    case "update-floor-settings": {
      const { coordinates, defaultWallHeightMeters, defaultCeilingHeightMeters } = action.settings;
      const valid =
        coordinates.origin.every(Number.isFinite) &&
        Number.isFinite(coordinates.metersPerPlanUnit) &&
        coordinates.metersPerPlanUnit > 0 &&
        (coordinates.scaleBasis === "measured" || coordinates.scaleBasis === "inferred") &&
        Number.isFinite(defaultWallHeightMeters) &&
        defaultWallHeightMeters > 0 &&
        Number.isFinite(defaultCeilingHeightMeters) &&
        defaultCeilingHeightMeters > 0;
      if (!valid) return draft;
      const unchanged =
        samePoint(draft.coordinates.origin, coordinates.origin) &&
        draft.coordinates.metersPerPlanUnit === coordinates.metersPerPlanUnit &&
        draft.coordinates.scaleBasis === coordinates.scaleBasis &&
        draft.defaultWallHeightMeters === defaultWallHeightMeters &&
        draft.defaultCeilingHeightMeters === defaultCeilingHeightMeters;
      if (unchanged) return draft;
      return {
        ...draft,
        coordinates: {
          origin: [...coordinates.origin],
          metersPerPlanUnit: coordinates.metersPerPlanUnit,
          scaleBasis: coordinates.scaleBasis,
        },
        defaultWallHeightMeters,
        defaultCeilingHeightMeters,
      };
    }
    case "replace-draft":
      return action.draft;
    case "add-hedge": {
      if (!validHedge(action.hedge, draft.coordinates.metersPerPlanUnit)) return draft;
      const serial = unusedElementSerial(draft, "hedge");
      return {
        ...draft,
        hedges: [
          ...(draft.hedges ?? []),
          { ...action.hedge, id: `${draft.floorId}:hedge-${serial}` },
        ],
        nextSerial: serial + 1,
        selection: null,
      };
    }
    case "update-hedge": {
      const hedge = draft.hedges?.find((entry) => entry.id === action.id);
      if (
        !hedge ||
        !validHedge({ ...hedge, ...action.changes }, draft.coordinates.metersPerPlanUnit)
      )
        return draft;
      return {
        ...draft,
        hedges: draft.hedges!.map((entry) =>
          entry.id === action.id ? { ...entry, ...action.changes } : entry,
        ),
      };
    }
    case "add-outdoor-platform": {
      if (
        !isOutdoorPlatformOutline(action.polygon) ||
        !validPlatformEdgeConfiguration(action.defaultEdge)
      )
        return draft;
      const serial = unusedElementSerial(draft, "platform");
      const id = `${draft.floorId}:platform-${serial}`;
      const platform = {
        id,
        polygon: action.polygon,
        finish: action.finish,
        defaultEdge: action.defaultEdge,
        edges: action.polygon.map((_, index) => ({
          id: unusedElementId(draft, `${id}:edge-${index + 1}`),
        })),
      };
      return {
        ...draft,
        outdoorPlatforms: [...(draft.outdoorPlatforms ?? []), platform],
        nextSerial: serial + 1,
        tool: "select",
        selection: { kind: "outdoor-platform", id },
      };
    }
    case "update-outdoor-platform": {
      const current = draft.outdoorPlatforms?.find((platform) => platform.id === action.id);
      if (
        !current ||
        (action.changes.defaultEdge && !validPlatformEdgeConfiguration(action.changes.defaultEdge))
      )
        return draft;
      const polygon = action.changes.polygon ?? current.polygon;
      if (
        !Array.isArray(polygon) ||
        polygon.length < 3 ||
        !polygon.every((point) => point.length === 2 && point.every(Number.isFinite))
      )
        return draft;
      const next = { ...platformWithPolygon(current, polygon), ...action.changes };
      if (action.changes.polygon && !action.changes.edges)
        next.edges = platformWithPolygon(current, polygon).edges;
      if (JSON.stringify(next) === JSON.stringify(current)) return draft;
      return {
        ...draft,
        outdoorPlatforms: draft.outdoorPlatforms!.map((platform) =>
          platform.id === action.id ? next : platform,
        ),
      };
    }
    case "add-pool": {
      if (!isPoolOutline(action.polygon)) return draft;
      const serial = unusedElementSerial(draft, "pool");
      return {
        ...draft,
        pools: [
          ...(draft.pools ?? []),
          { id: `${draft.floorId}:pool-${serial}`, polygon: action.polygon },
        ],
        selection: null,
        nextSerial: serial + 1,
      };
    }
    case "add-floor-zone": {
      if (!isFloorZoneOutline(action.polygon)) return draft;
      const serial = unusedElementSerial(draft, "floor-zone");
      const zone: FloorFinishZoneSpec = {
        id: `${draft.floorId}:floor-zone-${serial}`,
        polygon: action.polygon,
        finish: action.finish,
      };
      const previous = draft.rooms.find((room) => room.id === action.room.id);
      const room = previous ?? { ...action.room };
      return {
        ...draft,
        rooms: previous
          ? draft.rooms.map((candidate) =>
              candidate.id === previous.id
                ? {
                    ...candidate,
                    floorZones: [...(candidate.floorZones ?? []), zone],
                  }
                : candidate,
            )
          : [...draft.rooms, { ...room, floorZones: [zone] }],
        selection: { kind: "floor-zone", id: zone.id },
        nextSerial: serial + 1,
      };
    }
    case "add-ground-zone": {
      if (!isFloorZoneOutline(action.polygon)) return draft;
      const serial = unusedElementSerial(draft, "ground-zone");
      const zone: FloorFinishZoneSpec = {
        id: `${draft.floorId}:ground-zone-${serial}`,
        polygon: action.polygon,
        finish: action.finish,
      };
      return {
        ...draft,
        groundZones: [...(draft.groundZones ?? []), zone],
        selection: { kind: "floor-zone", id: zone.id },
        nextSerial: serial + 1,
      };
    }
    case "update-floor-zone": {
      const groundZone = draft.groundZones?.find((zone) => zone.id === action.zoneId);
      if (groundZone) {
        const groundZones = draft.groundZones!.map((zone) =>
          zone.id === action.zoneId ? { ...zone, ...action.changes } : zone,
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
        zone.id === action.zoneId ? { ...zone, ...action.changes } : zone,
      );
      if (JSON.stringify(floorZones) === JSON.stringify(owner.floorZones)) {
        return draft;
      }
      return {
        ...draft,
        rooms: draft.rooms.map((room) => (room.id === owner.id ? { ...room, floorZones } : room)),
      };
    }
    case "update-pool": {
      const current = draft.pools?.find((pool) => pool.id === action.poolId);
      // Finite but invalid outlines remain editable/recoverable; publication validates them.
      if (
        !current ||
        action.polygon.length !== current.polygon.length ||
        !action.polygon.every((point) => point.length === 2 && point.every(Number.isFinite)) ||
        current.polygon.every((point, index) => samePoint(point, action.polygon[index]))
      )
        return draft;
      return {
        ...draft,
        pools: draft.pools!.map((pool) =>
          pool.id === action.poolId ? { ...pool, polygon: action.polygon } : pool,
        ),
      };
    }
    case "add-wall":
      return addEditorWall(draft, action);
    case "move-endpoint":
      return samePoint(action.from, action.to)
        ? draft
        : {
            ...draft,
            walls: draft.walls.map((wall) => ({
              ...wall,
              from: samePoint(wall.from, action.from) ? action.to : wall.from,
              to: samePoint(wall.to, action.from) ? action.to : wall.to,
            })),
            rooms: draft.rooms.map((room) => ({
              ...room,
              anchor: samePoint(room.anchor, action.from) ? action.to : room.anchor,
            })),
          };
    case "translate-wall": {
      const wall = draft.walls.find((candidate) => candidate.id === action.wallId);
      if (!wall) return draft;
      const translatedFrom = moved(wall.from, action.delta);
      const translatedTo = moved(wall.to, action.delta);
      const translateConnectedPoint = (point: PlanPoint): PlanPoint => {
        if (samePoint(point, wall.from)) return translatedFrom;
        if (samePoint(point, wall.to)) return translatedTo;
        return point;
      };
      return {
        ...draft,
        walls: draft.walls.map((candidate) => ({
          ...candidate,
          from: translateConnectedPoint(candidate.from),
          to: translateConnectedPoint(candidate.to),
        })),
        rooms: draft.rooms.map((room) => ({
          ...room,
          anchor: translateConnectedPoint(room.anchor),
        })),
      };
    }
    case "update-wall-metadata":
      return {
        ...draft,
        walls: draft.walls.map((wall) =>
          wall.id === action.wallId
            ? {
                ...wall,
                ...action.changes,
                ...(action.changes.thicknessMeters !== undefined
                  ? { thicknessMeters: Math.max(0.04, round(action.changes.thicknessMeters)) }
                  : {}),
                ...(action.changes.heightMeters !== undefined
                  ? { heightMeters: Math.max(0.3, round(action.changes.heightMeters)) }
                  : {}),
              }
            : wall,
        ),
      };
    case "delete-selection": {
      if (!draft.selection) return draft;
      return deleteElements(draft, floorEditorSelectionTargets(draft.selection));
    }
    case "delete-elements":
      return deleteElements(draft, action.targets);
    case "add-opening": {
      const serial = unusedElementSerial(draft, action.kind);
      const id = `${draft.floorId}:${action.kind}-${serial}`;
      const width = (action.kind === "window" ? 1.2 : 0.9) / draft.coordinates.metersPerPlanUnit;
      const shared = {
        id,
        wallId: action.wallId,
        offsetPlanUnits: round(action.offsetPlanUnits),
        widthPlanUnits: width,
        openingHeightMeters: action.kind === "window" ? 1.2 : 2.04,
        sillHeightMeters: action.kind === "window" ? 0.9 : 0,
      };
      const next: EditorOpening =
        action.kind === "door"
          ? (() => {
              const { offsetFromWallStartPlanUnits, ...door } = doorFromConfiguration(
                action.doorConfiguration ?? DEFAULT_DOOR_CONFIGURATION,
                draft.coordinates.metersPerPlanUnit,
                {
                  id,
                  wallId: action.wallId,
                  offsetFromWallStartPlanUnits: round(action.offsetPlanUnits),
                },
              );
              return { ...door, offsetPlanUnits: offsetFromWallStartPlanUnits };
            })()
          : action.kind === "window"
            ? {
                ...shared,
                kind: "window",
                operation: "casement",
                variant: "plain",
                panelCount: 1,
                glazing: "clear",
              }
            : { ...shared, kind: "passage", variant: "rectangular" };
      return {
        ...draft,
        openings: [...draft.openings, next],
        selection: { kind: "opening", id },
        nextSerial: serial + 1,
      };
    }
    case "duplicate-opening": {
      const source = draft.openings.find((opening) => opening.id === action.openingId);
      const offsetPlanUnits = duplicateOpeningOffset(draft, action.openingId);
      if (!source || offsetPlanUnits === undefined) return draft;
      const id = unusedElementId(draft, `${source.id}-copy`);
      const copy: EditorOpening =
        source.kind === "window" && source.muntins
          ? {
              ...source,
              id,
              offsetPlanUnits: round(offsetPlanUnits),
              muntins: { ...source.muntins },
            }
          : { ...source, id, offsetPlanUnits: round(offsetPlanUnits) };
      return {
        ...draft,
        openings: [...draft.openings, copy],
        selection: { kind: "opening", id },
      };
    }
    case "move-opening":
      return draft.openings.some(
        (opening) =>
          opening.id === action.openingId &&
          (opening.wallId !== action.wallId ||
            opening.offsetPlanUnits !== round(action.offsetPlanUnits)),
      )
        ? {
            ...draft,
            openings: draft.openings.map((opening) =>
              opening.id === action.openingId
                ? {
                    ...opening,
                    wallId: action.wallId,
                    offsetPlanUnits: round(action.offsetPlanUnits),
                  }
                : opening,
            ),
          }
        : draft;
    case "resize-opening":
      return {
        ...draft,
        openings: draft.openings.map((opening) =>
          opening.id === action.openingId
            ? {
                ...opening,
                widthPlanUnits: Math.max(
                  0.3 / draft.coordinates.metersPerPlanUnit,
                  round(action.widthPlanUnits),
                ),
              }
            : opening,
        ),
      };
    case "reorient-opening": {
      const current = draft.openings.find((opening) => opening.id === action.openingId);
      if (!current || current.kind === "passage") return draft;
      const updated = changeOpeningOrientation(current, action.change);
      if (updated === current) return draft;
      return {
        ...draft,
        openings: draft.openings.map((opening) => (opening === current ? updated : opening)),
      };
    }
    case "update-opening": {
      if (action.opening.kind === "niche") return draft;
      const updatedOpening = action.opening;
      const current = draft.openings.find((opening) => opening.id === updatedOpening.id);
      if (!current || current.kind !== action.opening.kind) return draft;
      return {
        ...draft,
        openings: draft.openings.map((opening) =>
          opening.id === action.opening.id
            ? {
                ...updatedOpening,
                offsetPlanUnits: round(action.opening.offsetPlanUnits),
                widthPlanUnits: Math.max(
                  0.3 / draft.coordinates.metersPerPlanUnit,
                  round(action.opening.widthPlanUnits),
                ),
              }
            : opening,
        ),
      };
    }
    case "name-room": {
      const exists = draft.rooms.some((room) => room.id === action.roomId);
      const previous = draft.rooms.find((room) => room.id === action.roomId);
      const identity = {
        ...previous,
        id: action.roomId,
        name: action.name,
        accent: action.accent,
        anchor: action.anchor,
      };
      return {
        ...draft,
        rooms: exists
          ? draft.rooms.map((room) => (room.id === action.roomId ? identity : room))
          : [...draft.rooms, identity],
        selection: { kind: "room", id: action.roomId },
      };
    }
    case "update-room-metadata": {
      const previous = draft.rooms.find((room) => room.id === action.roomId);
      const next: EditorRoomIdentity = {
        id: action.roomId,
        name: previous?.name ?? "",
        accent: previous?.accent ?? "#c9a477",
        ...previous,
        ...action.changes,
        anchor: action.anchor,
      };
      return {
        ...draft,
        rooms: previous
          ? draft.rooms.map((room) => (room.id === action.roomId ? next : room))
          : [...draft.rooms, next],
        selection: { kind: "room", id: action.roomId },
      };
    }
    case "resolve-room-merge": {
      const mergedIds = new Set(action.mergedRoomIds);
      if (!mergedIds.has(action.survivorId)) return draft;
      const survivor = draft.rooms.find((room) => room.id === action.survivorId);
      if (!survivor) return draft;
      return {
        ...draft,
        rooms: draft.rooms
          .filter((room) => !mergedIds.has(room.id) || room.id === action.survivorId)
          .map((room) =>
            room.id === action.survivorId ? { ...room, anchor: action.anchor } : room,
          ),
        selection: { kind: "room", id: action.survivorId },
      };
    }
    case "discard-room-identity":
      return {
        ...draft,
        rooms: draft.rooms.filter((room) => room.id !== action.roomId),
        selection: null,
      };
  }
};

/** Wall resizing removes openings that no longer fit in their support. */
export const reduceDraft = (
  draft: FloorEditorDraft,
  action: Exclude<FloorEditorAction, { type: "undo" | "redo" }>,
): FloorEditorDraft => {
  let next = reduceDraftAction(draft, action);
  if (
    next === draft ||
    !["move-endpoint", "translate-wall", "update-wall-metadata", "update-floor-settings"].includes(
      action.type,
    )
  )
    return next;
  next = constrainWallNiches(next);
  const openings = next.openings.filter((opening) => {
    const wall = next.walls.find((candidate) => candidate.id === opening.wallId);
    const previous = draft.walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall || !previous) return true;
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
    const oldLength = Math.hypot(
      previous.to[0] - previous.from[0],
      previous.to[1] - previous.from[1],
    );
    const height = wall.heightMeters ?? next.defaultWallHeightMeters;
    const oldHeight = previous.heightMeters ?? draft.defaultWallHeightMeters;
    if (length >= oldLength && height >= oldHeight) return true;
    return (
      opening.offsetPlanUnits >= 0 &&
      opening.offsetPlanUnits + opening.widthPlanUnits <= length + 1e-7 &&
      (opening.sillHeightMeters ?? 0) + opening.openingHeightMeters <= height + 1e-7
    );
  });
  return openings.length === next.openings.length ? next : { ...next, openings };
};
