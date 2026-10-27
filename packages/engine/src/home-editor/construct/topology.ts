import { isOutdoorPlatformOutline } from "../../outdoor-platforms/platform-geometry";
/*
 * Planar face traversal follows the conventional directed half-edge walk used
 * by OpenPlan3D and ai_room_planner (MIT). The implementation is original to
 * Cabane and keeps the data model independent from either application.
 */

import type { FloorSpec, ManifestIssue, OpeningSpec, Polygon, WallSpec } from "../../types";
import { FLOOR_EDITOR_EPSILON, FloorTopologyInput, FloorTopologyResult } from "./topology-contract";
import { footprintForFaces } from "./topology-footprint";
import { buildGraph, connected, traverseFaces } from "./topology-graph";
import { deriveJunctions } from "./topology-junctions";
import { centroid, containsPoint, issue, length, round } from "./topology-plan-math";
import { normalizeWallRuns } from "./topology-wall-runs";

export const deriveFloorTopology = (input: FloorTopologyInput): FloorTopologyResult => {
  const issues: ManifestIssue[] = [];
  if (
    input.walls.length === 0 &&
    input.outdoorPlatforms?.some((p) => isOutdoorPlatformOutline(p.polygon))
  ) {
    const polygons = input.outdoorPlatforms
      .filter((p) => isOutdoorPlatformOutline(p.polygon))
      .map((p) => p.polygon);
    const bounds = footprintForFaces(polygons, issues);
    if (bounds)
      return {
        issues,
        faces: [],
        classifications: {},
        wallRuns: [],
        floor: {
          ...(input.belowGround !== undefined ? { belowGround: input.belowGround } : {}),
          id: input.floorId,
          name: input.floorName,
          floorToFloorHeightMeters: input.floorToFloorHeightMeters ?? 2.8,
          coordinates: input.coordinates ?? {
            origin: [0, 0],
            metersPerPlanUnit: 1,
            scaleBasis: "inferred",
          },
          defaultWallHeightMeters: input.defaultWallHeightMeters ?? 2.5,
          defaultCeilingHeightMeters: input.defaultCeilingHeightMeters ?? 2.5,
          footprint: bounds.footprint,
          ...(bounds.regions.length > 1 ? { footprintRegions: bounds.regions } : {}),
          walls: [],
          rooms: [],
          openings: [],
          wallJunctions: [],
          ceilings: [],
          outdoorPlatforms: input.outdoorPlatforms,
          ...(input.hedges ? { hedges: input.hedges } : {}),
          ...(input.pools ? { pools: input.pools } : {}),
          ...(input.groundZones ? { groundZones: input.groundZones } : {}),
        },
      };
  }
  if (input.walls.length < 3) {
    issues.push(
      issue(
        "topology.walls-required",
        "walls",
        "Draw at least three walls around one closed room.",
      ),
    );
    return { issues, faces: [], classifications: {}, wallRuns: [] };
  }
  const ids = new Set<string>();
  input.walls.forEach((wall, index) => {
    if (!wall.id.trim() || ids.has(wall.id))
      issues.push(
        issue("topology.wall-id", `walls[${index}].id`, "Every wall needs a unique stable ID."),
      );
    ids.add(wall.id);
    if (length(wall) <= FLOOR_EDITOR_EPSILON)
      issues.push(
        issue(
          "topology.wall-length",
          `walls.${wall.id}`,
          "Walls must have a visible non-zero length.",
        ),
      );
  });
  const { nodes, subsegments } = buildGraph(input.walls, issues);
  const graphConnected = connected(nodes, subsegments);
  const { faces, edgeFace } = traverseFaces(nodes, subsegments);
  if (faces.length === 0) {
    issues.push(
      issue(
        graphConnected ? "topology.no-rooms" : "topology.incomplete-shell",
        "walls",
        graphConnected
          ? "Keep drawing until the walls close around a room."
          : "Connect the wall endpoints and close at least one room.",
      ),
    );
  }
  const { runs: normalizedWallRuns, classifications } = normalizeWallRuns(
    input.walls,
    subsegments,
    edgeFace,
  );
  const normalizedEditorWalls = normalizedWallRuns.map((run) => run.wall);
  const wallRuns = normalizedWallRuns.map(({ wall: _wall, ...run }) => run);
  const junctions = deriveJunctions(normalizedEditorWalls, nodes, input.junctions ?? []);
  const footprintResult = footprintForFaces(faces, issues);

  const assigned = new Set<string>();
  const reservedRoomIds = new Set(input.rooms.map((room) => room.id));
  const reservedNames = new Set(
    [...input.rooms.map((room) => room.name), ...(input.reservedRoomNames ?? [])].map((name) =>
      name.trim().toLowerCase(),
    ),
  );
  let newNameSerial = 1;
  const nextRoomName = () => {
    while (reservedNames.has(`unnamed room ${newNameSerial}`)) newNameSerial += 1;
    const name = `Unnamed room ${newNameSerial++}`;
    reservedNames.add(name.toLowerCase());
    return name;
  };
  let newRoomSerial = 1;
  const nextRoomId = () => {
    while (reservedRoomIds.has(`${input.floorId}:room-${newRoomSerial}`)) newRoomSerial += 1;
    const id = `${input.floorId}:room-${newRoomSerial}`;
    reservedRoomIds.add(id);
    newRoomSerial += 1;
    return id;
  };
  const rooms = faces.map((face, faceIndex) => {
    const anchored = input.rooms.filter((room) => containsPoint(room.anchor, face));
    if (anchored.length > 1) {
      issues.push(
        issue(
          "topology.room-merge",
          `rooms[${faceIndex}]`,
          `Choose which room name and ID to keep after this merge: ${anchored.map((room) => room.name || room.id).join(", ")}.`,
        ),
      );
    }
    const identity = anchored.find((room) => !assigned.has(room.id));
    if (identity) assigned.add(identity.id);
    const id = identity?.id ?? nextRoomId();
    const name = identity?.name.trim() ?? nextRoomName();
    if (!name)
      issues.push(
        issue(
          "topology.room-name",
          `rooms.${id}.name`,
          "Name every closed room before applying the floor plan.",
        ),
      );
    return {
      id,
      name,
      polygon: face,
      ...(identity?.isSolid !== undefined ? { isSolid: identity.isSolid } : {}),
      accent: identity?.accent || input.defaultRoomAccent || "#c9a477",
      ...(identity?.floorFinish
        ? {
            floorFinish: { ...identity.floorFinish },
          }
        : {}),
      ...(identity?.floorZones?.length
        ? {
            floorZones: identity.floorZones.map((zone) => ({
              ...zone,
              polygon: zone.polygon.map((point) => [...point]) as unknown as Polygon,
              finish: { ...zone.finish },
            })),
          }
        : {}),
      dashboardSlots: [],
      devices: [],
    };
  });

  const openingOwners = input.openings.map((opening, index) => {
    const owner = input.walls.find((wall) => wall.id === opening.wallId);
    if (!owner) {
      issues.push(
        issue(
          "topology.opening-wall",
          `openings[${index}].wallId`,
          `Opening “${opening.id}” has no supporting wall.`,
        ),
      );
      return undefined;
    } else if (
      opening.offsetPlanUnits < 0 ||
      opening.offsetPlanUnits + opening.widthPlanUnits > length(owner) + FLOOR_EDITOR_EPSILON
    ) {
      issues.push(
        issue(
          "topology.opening-containment",
          `openings.${opening.id}`,
          `Opening “${opening.id}” must stay completely inside its wall.`,
        ),
      );
      return undefined;
    }
    const ownerRun = normalizedWallRuns.find(
      (run) =>
        run.sourceWallId === opening.wallId &&
        opening.offsetPlanUnits >= run.startOffsetPlanUnits - FLOOR_EDITOR_EPSILON &&
        opening.offsetPlanUnits + opening.widthPlanUnits <=
          run.endOffsetPlanUnits + FLOOR_EDITOR_EPSILON,
    );
    if (!ownerRun) {
      issues.push(
        issue(
          "topology.opening-split",
          `openings.${opening.id}`,
          `Opening “${opening.id}” crosses a wall classification junction; move it fully onto either wall section.`,
        ),
      );
    }
    return ownerRun;
  });

  if (!footprintResult || faces.length === 0) return { issues, faces, classifications, wallRuns };
  const exteriorThickness = input.exteriorWallThicknessMeters ?? 0.2;
  const interiorThickness = input.interiorWallThicknessMeters ?? 0.12;
  const wallHeight = input.defaultWallHeightMeters ?? 2.5;
  const ceilingHeight = input.defaultCeilingHeightMeters ?? 2.5;
  const walls: WallSpec[] = normalizedWallRuns.map(({ wall, classification }) => ({
    id: wall.id,
    from: wall.from,
    to: wall.to,
    classification,
    thicknessMeters:
      wall.thicknessMeters ??
      (classification === "interior" ? interiorThickness : exteriorThickness),
    ...(wall.heightMeters && wall.heightMeters !== wallHeight
      ? { heightMeters: wall.heightMeters }
      : {}),
    ...(wall.exteriorColor ? { exteriorColor: wall.exteriorColor } : {}),
    ...(wall.edgeColor ? { edgeColor: wall.edgeColor } : {}),
    ...(wall.faceColors ? { faceColors: { ...wall.faceColors } } : {}),
    ...(wall.faceFinishes ? { faceFinishes: structuredClone(wall.faceFinishes) } : {}),
    ...(wall.niches ? { niches: wall.niches.map((niche) => ({ ...niche })) } : {}),
  }));
  const openings: OpeningSpec[] = input.openings.flatMap((opening, index): OpeningSpec[] => {
    const ownerRun = openingOwners[index];
    if (!ownerRun) return [];
    const shared = {
      id: opening.id,
      wallId: ownerRun.wallId,
      offsetFromWallStartPlanUnits: round(opening.offsetPlanUnits - ownerRun.startOffsetPlanUnits),
      widthPlanUnits: round(opening.widthPlanUnits),
      openingHeightMeters: opening.openingHeightMeters,
      sillHeightMeters: opening.sillHeightMeters,
    };
    if (opening.kind === "door") {
      const { offsetPlanUnits: _offset, ...design } = opening;
      return [{ ...design, ...shared }];
    }
    if (opening.kind === "window")
      return [
        {
          ...shared,
          kind: "window",
          operation: opening.operation,
          variant: opening.variant,
          panelCount: opening.panelCount,
          ...(opening.hingeSide !== undefined ? { hingeSide: opening.hingeSide } : {}),
          ...(opening.openingSide !== undefined ? { openingSide: opening.openingSide } : {}),
          glazing: opening.glazing,
          ...(opening.color !== undefined ? { color: opening.color } : {}),
          ...(opening.muntins ? { muntins: { ...opening.muntins } } : {}),
        },
      ];
    return opening.variant === "arched"
      ? [{ ...shared, kind: "passage", variant: "arched", archRiseMeters: opening.archRiseMeters }]
      : [{ ...shared, kind: "passage", variant: "rectangular" }];
  });
  const roomIdentityById = new Map(input.rooms.map((identity) => [identity.id, identity]));
  // An accepted ceiling may span several rooms. Keep it one shared surface
  // rather than publishing duplicate IDs after the first unrelated edit.
  const ceilings: Array<{ id: string; kind: "flat"; roomIds: string[]; heightMeters: number }> = [];
  const ceilingGroups = new Map<string, Map<number, (typeof ceilings)[number]>>();
  const reservedCeilingIds = new Set(
    rooms.map((room) => roomIdentityById.get(room.id)?.ceilingId ?? `${room.id}-ceiling`),
  );
  for (const room of rooms) {
    const identity = roomIdentityById.get(room.id);
    const preferredId = identity?.ceilingId ?? `${room.id}-ceiling`;
    const heightMeters = identity?.ceilingHeightMeters ?? ceilingHeight;
    let groups = ceilingGroups.get(preferredId);
    const existing = groups?.get(heightMeters);
    if (existing) {
      existing.roomIds.push(room.id);
      continue;
    }
    let id = preferredId;
    if (groups) {
      id = `${preferredId}-${room.id}`;
      let suffix = 2;
      while (reservedCeilingIds.has(id)) id = `${preferredId}-${room.id}-${suffix++}`;
    } else ceilingGroups.set(preferredId, (groups = new Map<number, (typeof ceilings)[number]>()));
    reservedCeilingIds.add(id);
    const ceiling = { id, kind: "flat" as const, roomIds: [room.id], heightMeters };
    groups.set(heightMeters, ceiling);
    ceilings.push(ceiling);
  }
  const floor: FloorSpec = {
    ...(input.belowGround !== undefined ? { belowGround: input.belowGround } : {}),
    floorToFloorHeightMeters: input.floorToFloorHeightMeters ?? Math.max(wallHeight, ceilingHeight),
    id: input.floorId,
    name: input.floorName,
    ...(input.hedges ? { hedges: input.hedges } : {}),
    ...(input.outdoorPlatforms ? { outdoorPlatforms: input.outdoorPlatforms } : {}),
    ...(input.pools ? { pools: input.pools } : {}),
    ...(input.groundZones
      ? {
          groundZones: input.groundZones.map((zone) => ({
            ...zone,
            polygon: zone.polygon.map((point) => [...point]) as unknown as Polygon,
            finish: { ...zone.finish },
          })),
        }
      : {}),
    coordinates: input.coordinates
      ? {
          origin: [...input.coordinates.origin],
          metersPerPlanUnit: input.coordinates.metersPerPlanUnit,
          scaleBasis: input.coordinates.scaleBasis,
        }
      : { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
    defaultWallHeightMeters: wallHeight,
    defaultCeilingHeightMeters: ceilingHeight,
    footprint: footprintResult.footprint,
    ...(footprintResult.regions.length > 1 ? { footprintRegions: footprintResult.regions } : {}),
    rooms,
    walls,
    wallJunctions: junctions,
    openings,
    ceilings,
  };
  return { floor, issues, faces, classifications, wallRuns };
};

export const roomAnchorForPolygon = centroid;
export { FLOOR_EDITOR_EPSILON } from "./topology-contract";
export type {
  DerivedWallRun,
  EditorOpening,
  EditorRoomIdentity,
  EditorWall,
  FloorTopologyInput,
  FloorTopologyResult,
  RemappedWallOffset,
} from "./topology-contract";
export { remapWallOffsetToDerivedRun } from "./topology-wall-runs";
