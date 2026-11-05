import { useMemo } from "react";
import { physicalFloor } from "./architecture-geometry/physical-floor";
import type { FloorSpec } from "./types";

// Composition can rebuild opening/room profiles without changing geometry.
// Keep the same structural definition for the built floor and its neighbors.
const architectureFloorKey = (floor: FloorSpec) =>
  JSON.stringify({
    ...floor,
    rooms: floor.rooms.map(
      ({ devices: _devices, dashboardSlots: _slots, furnishings: _furnishings, ...room }) => room,
    ),
    openings: floor.openings.map(
      ({ contactSlot: _contactSlot, coverSlot: _coverSlot, ...opening }) => opening,
    ),
  });

/** Runtime profiles do not invalidate built floors; virtual dividers are removed. */
export function useSceneArchitectureFloor<T extends FloorSpec>(floor: T): T {
  const key = architectureFloorKey(floor);
  // Give downstream geometry memos a new identity whenever the structural
  // key changes, even if an editor updated the supplied FloorSpec in place.
  // Reusing `floor` directly left the previous solid wall mesh mounted while
  // the new opening model rendered inside it.
  // Structural key excludes runtime bindings; including floor would rebuild architectural meshes on entity updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => physicalFloor({ ...floor }) as T, [key]);
}

/** Preserve neighbor inputs to wall cuts/caps across item-only recomposition. */
export function useSceneArchitectureNeighbors(
  below: FloorSpec | undefined,
  above: FloorSpec | undefined,
) {
  const key = JSON.stringify([
    below && architectureFloorKey(below),
    above && architectureFloorKey(above),
  ]);
  // Retain the authored neighbor semantics. New snapshots also detect edits
  // made in place, while runtime-only room/device profiles stay irrelevant.
  return useMemo(
    () => ({ below: below && { ...below }, above: above && { ...above } }),
    // The structural key completely describes the inputs used by wall geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}
