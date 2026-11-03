import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createFloorNavigation, resolveFloorNavigation } from "./floor-navigation";

export type { FloorSelectionSource } from "./floor-navigation";
type FloorNavigation = ReturnType<typeof createFloorNavigation>;
const FloorNavigationContext = createContext<FloorNavigation | null>(null);

export function FloorNavigationProvider({
  children,
  initialFloorId,
  storageKey,
}: {
  children: ReactNode;
  initialFloorId?: string;
  /** Opt in only for the routed workspace; previews and fixtures stay ephemeral. */
  storageKey?: string;
}) {
  const [navigation] = useState(() => createFloorNavigation(initialFloorId, storageKey));
  return (
    <FloorNavigationContext.Provider value={navigation}>{children}</FloorNavigationContext.Provider>
  );
}

/** Standalone fixtures own an ephemeral instance; routed views use their provider. */
export function useFloorNavigation(floors: readonly { id: string; belowGround?: boolean }[]) {
  const shared = useContext(FloorNavigationContext);
  const local = useRef<FloorNavigation | null>(null);
  const navigation = shared ?? (local.current ??= createFloorNavigation());
  const snapshot = useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
    navigation.getSnapshot,
  );
  useEffect(() => {
    navigation.reconcile(floors);
  }, [navigation, floors, snapshot.selection]);
  return {
    ...resolveFloorNavigation(snapshot, floors),
    selectFloor: navigation.selectFloor,
    setWholeBuilding: navigation.setWholeBuilding,
  };
}
