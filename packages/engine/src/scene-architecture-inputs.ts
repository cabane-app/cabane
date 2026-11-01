import { useMemo } from "react";
import { physicalFloor } from "./architecture-geometry/physical-floor";
import type { FloorSpec } from "./types";

/**
 * Runtime device/profile changes do not invalidate architectural mesh inputs.
 * The returned floor is the floor as built, without virtual room dividers.
 */
export function useSceneArchitectureFloor<T extends FloorSpec>(floor: T): T {
  // Composition can rebuild opening/room profile arrays without changing their
  // geometry. This small structural key is much cheaper than polygon union and
  // deliberately excludes runtime entities, scene items, and UI selection.
  const key = JSON.stringify({
    ...floor,
    rooms: floor.rooms.map(
      ({ devices: _devices, dashboardSlots: _slots, furnishings: _furnishings, ...room }) => room,
    ),
    openings: floor.openings.map(
      ({ contactSlot: _contactSlot, coverSlot: _coverSlot, ...opening }) => opening,
    ),
  });
  // Give downstream geometry memos a new identity whenever the structural
  // key changes, even if an editor updated the supplied FloorSpec in place.
  // Reusing `floor` directly left the previous solid wall mesh mounted while
  // the new opening model rendered inside it.
  // Structural key excludes runtime bindings; including floor would rebuild architectural meshes on entity updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => physicalFloor({ ...floor }) as T, [key]);
}
