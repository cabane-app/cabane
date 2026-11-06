import {
  defineHomeProject,
  type DoorSpec,
  type HomeProject,
  type LayoutFloorSpec,
  type LayoutOpeningSpec,
  type LayoutRoomSpec,
  type RoomSpec,
  type SlopedCeilingSpec,
} from "../packages/engine/src";

declare const project: HomeProject;
declare const equippedRoom: RoomSpec;
declare const contactDoor: DoorSpec;
declare const slopedCeiling: SlopedCeilingSpec;
declare const floorWithSlopedCeiling: Omit<LayoutFloorSpec, "ceilings"> & {
  ceilings: readonly SlopedCeilingSpec[];
};

// @ts-expect-error Layout rooms cannot carry furnishing or binding overlays.
const layoutRoom: LayoutRoomSpec = equippedRoom;

// @ts-expect-error Layout openings cannot carry contact binding overlays.
const layoutOpening: LayoutOpeningSpec = contactDoor;

const layoutCeiling: NonNullable<LayoutFloorSpec["ceilings"]>[number] = slopedCeiling;

const layoutFloor: LayoutFloorSpec = floorWithSlopedCeiling;

defineHomeProject({
  ...project,
  // @ts-expect-error The serializable project contract rejects runtime fields.
  runtimeComponent: () => null,
});

void layoutRoom;
void layoutOpening;
void layoutCeiling;
void layoutFloor;
