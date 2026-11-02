import { roomsForFloor } from "../outdoor-platforms/platform-rooms";
import { stairFloorIds } from "../stairs/stair-connection";
import type { EditorWorkspaceSnapshot } from "../home-editor/workspace-history";
import { copyFloorContents, type FloorCopyOptions } from "./floor-duplication";
import type { DraftLayoutFloorSpec } from "./types";
import { removeWorkspaceSlotReferences } from "./workspace-bindings";
import { itemBindingSlotIds } from "./item-binding-identities";

export const addTopFloor = (
  snapshot: EditorWorkspaceSnapshot,
  id: string,
  copy?: FloorCopyOptions,
): EditorWorkspaceSnapshot => {
  const { project } = snapshot;
  if (!id.trim() || project.floors.some((floor) => floor.id === id))
    throw new Error("Choose a unique floor ID.");
  const top = project.floors.at(-1);
  if (!top) throw new Error("A building requires a ground floor.");
  const floor: DraftLayoutFloorSpec = {
    id,
    name: `Floor ${project.floors.filter((floor) => !floor.belowGround).length}`,
    coordinates: project.coordinates,
    floorToFloorHeightMeters: top.floorToFloorHeightMeters,
    defaultWallHeightMeters: top.defaultWallHeightMeters,
    defaultCeilingHeightMeters: top.defaultCeilingHeightMeters,
    footprint: [],
    rooms: [],
    walls: [],
    wallJunctions: [],
    openings: [],
    ceilings: [],
  };
  const next = { ...snapshot, project: { ...project, floors: [...project.floors, floor] } };
  return copy ? copyFloorContents(next, floor, copy) : next;
};

/** Add a basement beneath the current lowest level, optionally copying an existing floor. */
export const addBottomFloor = (
  snapshot: EditorWorkspaceSnapshot,
  id: string,
  copy?: FloorCopyOptions,
): EditorWorkspaceSnapshot => {
  const added = addTopFloor(snapshot, id);
  const lowest = snapshot.project.floors[0];
  const floor: DraftLayoutFloorSpec = {
    ...added.project.floors.at(-1)!,
    belowGround: true,
    name: `Floor −${snapshot.project.floors.filter((floor) => floor.belowGround).length + 1}`,
    floorToFloorHeightMeters: lowest.floorToFloorHeightMeters,
    defaultWallHeightMeters: lowest.defaultWallHeightMeters,
    defaultCeilingHeightMeters: lowest.defaultCeilingHeightMeters,
  };
  const next = {
    ...snapshot,
    project: { ...snapshot.project, floors: [floor, ...snapshot.project.floors] },
  };
  return copy ? copyFloorContents(next, floor, copy) : next;
};

export const floorRemovalDisabledReason = (
  floors: readonly DraftLayoutFloorSpec[],
  floorId: string,
): string | undefined => {
  const floor = floors.find((floor) => floor.id === floorId);
  if (!floor) return "The floor no longer exists.";
  if (floor === floors.find((floor) => !floor.belowGround))
    return "The ground floor cannot be deleted.";
  if (floor.belowGround && floor !== floors[0])
    return "Only the lowest basement can be deleted. Delete the floors below first.";
  if (!floor.belowGround && floor !== floors.at(-1))
    return "Only the top floor can be deleted. Delete the floors above first.";
  return undefined;
};

const updateFloor = (
  snapshot: EditorWorkspaceSnapshot,
  floorId: string,
  update: (floor: DraftLayoutFloorSpec) => DraftLayoutFloorSpec,
): EditorWorkspaceSnapshot => {
  if (!snapshot.project.floors.some((floor) => floor.id === floorId))
    throw new Error("The floor no longer exists.");
  return {
    ...snapshot,
    project: {
      ...snapshot.project,
      floors: snapshot.project.floors.map((floor) =>
        floor.id === floorId ? update(floor) : floor,
      ),
    },
  };
};

export const renameFloor = (
  snapshot: EditorWorkspaceSnapshot,
  floorId: string,
  name: string,
): EditorWorkspaceSnapshot => {
  if (!name.trim()) throw new Error("Enter a floor name.");
  return updateFloor(snapshot, floorId, (floor) => ({ ...floor, name: name.trim() }));
};

export const setFloorHeight = (
  snapshot: EditorWorkspaceSnapshot,
  floorId: string,
  heightMeters: number,
): EditorWorkspaceSnapshot => {
  if (!Number.isFinite(heightMeters) || heightMeters <= 0)
    throw new Error("Floor height must be positive finite metres.");
  return updateFloor(snapshot, floorId, (floor) => ({
    ...floor,
    floorToFloorHeightMeters: heightMeters,
  }));
};

export const removeTopFloor = (snapshot: EditorWorkspaceSnapshot): EditorWorkspaceSnapshot => {
  return removeFloor(snapshot, snapshot.project.floors.at(-1)?.id ?? "");
};

export const removeFloor = (
  snapshot: EditorWorkspaceSnapshot,
  floorId: string,
): EditorWorkspaceSnapshot => {
  const { project } = snapshot;
  const reason = floorRemovalDisabledReason(project.floors, floorId);
  if (reason) throw new Error(reason);
  const removedFloor = project.floors.find((floor) => floor.id === floorId)!;
  const roomIds = new Set(roomsForFloor(removedFloor).map((room) => room.id));
  const openingIds = new Set(removedFloor.openings.map((opening) => opening.id));
  const slotIds = [
    ...project.sceneItems
      .filter((item) => item.floorId === removedFloor.id)
      .flatMap(itemBindingSlotIds),
    ...roomsForFloor(removedFloor).flatMap(
      (room) => project.roomProfiles[room.id]?.dashboardSlots.map((slot) => slot.id) ?? [],
    ),
    ...removedFloor.openings.flatMap((opening) =>
      [
        project.openingProfiles[opening.id]?.contactSlot?.id,
        project.openingProfiles[opening.id]?.coverSlot?.id,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const bindings = removeWorkspaceSlotReferences(snapshot.bindings, slotIds);
  return {
    project: {
      ...project,
      floors: project.floors.filter((floor) => floor.id !== floorId),
      home:
        project.home.walkStart?.floorId === removedFloor.id
          ? (({ walkStart, ...home }) => home)(project.home)
          : project.home,
      sceneItems: project.sceneItems.filter((item) => item.floorId !== removedFloor.id),
      stairs: project.stairs.filter((stair) => !stairFloorIds(stair).includes(removedFloor.id)),
      roomProfiles: Object.fromEntries(
        Object.entries(project.roomProfiles).filter(([id]) => !roomIds.has(id)),
      ),
      openingProfiles: Object.fromEntries(
        Object.entries(project.openingProfiles).filter(([id]) => !openingIds.has(id)),
      ),
    },
    bindings: Object.fromEntries(
      Object.entries(bindings).map(([origin, state]) => [
        origin,
        {
          ...state,
          draft: {
            ...state.draft,
            roomAreaIds: Object.fromEntries(
              Object.entries(state.draft.roomAreaIds).filter(([id]) => !roomIds.has(id)),
            ),
          },
          manualRoomIds: state.manualRoomIds.filter((id) => !roomIds.has(id)),
        },
      ]),
    ),
  };
};
