import { readFloorPreference, writeFloorPreference } from "./floor-preference";
import { reconcileFloorSelection, type FloorSelectionState } from "./floor-selection";

export type FloorSelectionSource = "picker" | "walk" | "target";
type Floor = { id: string; belowGround?: boolean };
interface NavigationSnapshot {
  selection: FloorSelectionState;
  order: readonly string[];
}

export function resolveFloorNavigation(snapshot: NavigationSnapshot, floors: readonly Floor[]) {
  return reconcileFloorSelection(
    snapshot.selection,
    snapshot.order,
    floors.map((floor) => floor.id),
    floors.find((floor) => !floor.belowGround)?.id ?? "",
  );
}

/** One instance per workspace, preview, or standalone consumer. No global state. */
export function createFloorNavigation(initialFloorId = "", storageKey?: string) {
  let snapshot: NavigationSnapshot = {
    selection: {
      activeFloorId: initialFloorId || readFloorPreference(storageKey),
      wholeBuilding: false,
    },
    order: [],
  };
  const listeners = new Set<() => void>();
  const update = (selection: FloorSelectionState, order = snapshot.order) => {
    if (
      selection.activeFloorId === snapshot.selection.activeFloorId &&
      selection.wholeBuilding === snapshot.selection.wholeBuilding &&
      order.length === snapshot.order.length &&
      order.every((id, index) => id === snapshot.order[index])
    )
      return;
    snapshot = { selection, order };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reconcile(floors: readonly Floor[]) {
      update(
        resolveFloorNavigation(snapshot, floors),
        floors.map((floor) => floor.id),
      );
    },
    selectFloor(id: string, source: FloorSelectionSource = "target") {
      if (!id) return;
      if (source === "picker") writeFloorPreference(storageKey, id);
      update({ activeFloorId: id, wholeBuilding: false });
    },
    setWholeBuilding(wholeBuilding: boolean) {
      update({ ...snapshot.selection, wholeBuilding });
    },
  };
}
