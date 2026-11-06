import type {
  EditorWorkspaceSnapshot,
  FloorSpec,
  HomeEditorDomain,
  HomeProject,
  HomeProjectIssue,
  DraftLayoutFloorSpec,
  LayoutRoomSpec,
  ProjectCommand,
  ProjectModelRegistries,
  SceneItemSpec,
} from "@cabane/engine";
import {
  composeHomeManifest,
  indoorRoomsForFloor,
  roomsForFloor,
  reconcileWorkspaceBindings,
  itemBindingSlotIds,
  removeWorkspaceSlotReferences,
  validateHomeProject,
} from "@cabane/engine";

const sameJson = (left: unknown, right: unknown) =>
  Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);

/** Item-only Undo must not rederive architecture or reset its identities. */
export const projectEditorRestoration = (
  before: HomeProject,
  after: HomeProject,
  selectedId: string | null,
  floorId = before.floors[0]?.id,
) => ({
  floorChanged: !sameJson(
    before.floors.find((floor) => floor.id === floorId),
    after.floors.find((floor) => floor.id === floorId),
  ),
  selectedItemId:
    after.sceneItems.find((item) => !before.sceneItems.some((previous) => previous.id === item.id))
      ?.id ?? (after.sceneItems.some((item) => item.id === selectedId) ? selectedId : null),
});

const layoutFloors = new WeakMap<FloorSpec, DraftLayoutFloorSpec>();

export const layoutFloorFromEditorFloor = (floor: FloorSpec): DraftLayoutFloorSpec => {
  const cached = layoutFloors.get(floor);
  if (cached) return cached;
  const { ceilings: _ceilings, ...architecture } = floor;
  const layout: DraftLayoutFloorSpec = {
    ...architecture,
    ...(floor.ceilings
      ? { ceilings: floor.ceilings.filter((ceiling) => ceiling.kind === "flat") }
      : {}),
    rooms: indoorRoomsForFloor(floor).map((room) => {
      const {
        furnishings: _furnishings,
        dashboardSlots: _dashboardSlots,
        devices: _devices,
        ...layoutRoom
      } = room;
      return {
        ...layoutRoom,
        dashboardSlots: [] as const,
        devices: [] as const,
      } satisfies LayoutRoomSpec;
    }),
    openings: floor.openings.map((opening) => {
      const { contactSlot: _contactSlot, coverSlot: _coverSlot, ...layoutOpening } = opening;
      return layoutOpening;
    }),
  };
  layoutFloors.set(floor, layout);
  return layout;
};

/**
 * The editor draws flat ceilings only. Keep the sloped ceilings a floor already
 * has over rooms that still exist, in place of the flat ones it gives them.
 */
const withSlopedCeilings = (
  candidate: DraftLayoutFloorSpec,
  previous: DraftLayoutFloorSpec,
): DraftLayoutFloorSpec => {
  const roomIds = new Set(candidate.rooms.map((room) => room.id));
  const sloped = (previous.ceilings ?? []).flatMap((ceiling) => {
    if (ceiling.kind !== "sloped") return [];
    const kept = ceiling.roomIds.filter((id) => roomIds.has(id));
    return kept.length ? [{ ...ceiling, roomIds: kept }] : [];
  });
  if (!sloped.length) return candidate;
  const slopedRooms = new Set(sloped.flatMap((ceiling) => ceiling.roomIds));
  const flat = (candidate.ceilings ?? []).flatMap((ceiling) => {
    const kept = ceiling.roomIds.filter((id) => !slopedRooms.has(id));
    return kept.length ? [{ ...ceiling, roomIds: kept }] : [];
  });
  // Keep the saved order, so an unchanged floor still compares equal.
  const order = new Map((previous.ceilings ?? []).map((ceiling, index) => [ceiling.id, index]));
  return {
    ...candidate,
    ceilings: [...flat, ...sloped].sort(
      (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
    ),
  };
};

export const projectFromEditorState = (
  base: HomeProject,
  floor: FloorSpec,
  sceneItems: readonly SceneItemSpec[],
): HomeProject => {
  const previous = base.floors.find((entry) => entry.id === floor.id);
  if (!previous) return base; // A top-floor removal can precede the editor replacement render.
  const candidate = withSlopedCeilings(layoutFloorFromEditorFloor(floor), previous);
  const layoutFloor = sameJson(candidate, previous) ? previous : candidate;
  const floors =
    layoutFloor === previous
      ? base.floors
      : base.floors.map((entry) => (entry.id === floor.id ? layoutFloor : entry));
  const nextRoomProfiles = Object.fromEntries(
    floors
      .flatMap(roomsForFloor)
      .map((room) => [room.id, base.roomProfiles[room.id] ?? { dashboardSlots: [] }]),
  );
  const nextOpeningProfiles = Object.fromEntries(
    floors
      .flatMap((entry) => entry.openings)
      .map((opening) => [
        opening.id,
        opening.kind === "door" && opening.operation === "roll-up"
          ? (base.openingProfiles[opening.id] ?? {})
          : (() => {
              const { coverSlot: _cover, ...profile } = base.openingProfiles[opening.id] ?? {};
              return profile;
            })(),
      ]),
  );
  const roomProfiles = sameJson(nextRoomProfiles, base.roomProfiles)
    ? base.roomProfiles
    : nextRoomProfiles;
  const openingProfiles = sameJson(nextOpeningProfiles, base.openingProfiles)
    ? base.openingProfiles
    : nextOpeningProfiles;
  const nextItems = [
    ...base.sceneItems.filter((item) => item.floorId !== floor.id),
    ...sceneItems.filter((item) => item.floorId === floor.id),
  ];
  // Preserve order of existing items across floor edits; append new items last.
  const positions = new Map(base.sceneItems.map((item, index) => [item.id, index]));
  const ordered = nextItems.sort(
    (a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity),
  );
  const items = sameJson(ordered, base.sceneItems)
    ? base.sceneItems
    : sameJson(ordered, sceneItems)
      ? sceneItems
      : ordered;
  if (
    floors === base.floors &&
    items === base.sceneItems &&
    roomProfiles === base.roomProfiles &&
    openingProfiles === base.openingProfiles
  )
    return base;
  return {
    ...base,
    floors,
    sceneItems: items,
    roomProfiles,
    openingProfiles,
  };
};

/** Call only after gestures and architectural composition have settled. */
export const workspaceSnapshotFromEditorState = (
  base: EditorWorkspaceSnapshot,
  floor: FloorSpec,
  sceneItems: readonly SceneItemSpec[],
  registries: ProjectModelRegistries,
  additionalIssues: readonly HomeProjectIssue[] = [],
): EditorWorkspaceSnapshot => {
  const project = projectFromEditorState(base.project, floor, sceneItems);
  const retainedSlotIds = new Set(project.sceneItems.flatMap(itemBindingSlotIds));
  const removedSlotIds = base.project.sceneItems
    .flatMap(itemBindingSlotIds)
    .filter((id) => !retainedSlotIds.has(id));
  let bindings = removeWorkspaceSlotReferences(base.bindings, removedSlotIds);
  try {
    const validation = validateHomeProject(project, registries);
    if (![...validation.issues, ...additionalIssues].some((issue) => issue.severity === "error")) {
      bindings = reconcileWorkspaceBindings(
        bindings,
        composeHomeManifest(project, {
          furnishingModels: {},
          deviceModels: {},
          openingModels: {},
        }),
      );
    }
  } catch {
    // Invalid geometry remains editable, without pruning its mapping history.
  }
  return { project, bindings };
};

const EDITABLE_PROJECT_KEYS = [
  "floors",
  "stairs",
  "sceneItems",
  "roomProfiles",
  "openingProfiles",
] as const;

export const projectCommandForEditorChange = ({
  before,
  after,
  domain,
  id,
  label,
}: {
  before: HomeProject;
  after: HomeProject;
  domain: HomeEditorDomain;
  id: string;
  label: string;
}): ProjectCommand | null => {
  const changedKeys = EDITABLE_PROJECT_KEYS.filter((key) => !sameJson(before[key], after[key]));
  if (changedKeys.length === 0) return null;
  return {
    id,
    label,
    domain,
    before: changedKeys.map((key) => ({ path: [key], value: before[key] })),
    after: changedKeys.map((key) => ({ path: [key], value: after[key] })),
  };
};
