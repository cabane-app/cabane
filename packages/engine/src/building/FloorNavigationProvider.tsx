import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { reconcileFloorSelection } from "./floor-selection";

export type FloorSelectionSource = "picker" | "walk" | "target";
interface NavigationState {
  activeFloorId: string;
  wholeBuilding: boolean;
  source: FloorSelectionSource;
  request: number;
}
const initial: NavigationState = {
  activeFloorId: "",
  wholeBuilding: false,
  source: "target",
  request: 0,
};
const useNavigationState = (initialFloorId = "", storageKey?: string) => {
  const [state, setState] = useState(() => {
    let activeFloorId = initialFloorId;
    try {
      if (!activeFloorId && storageKey)
        activeFloorId = window.localStorage.getItem(storageKey) ?? "";
    } catch {
      // Navigation remains available when browser storage is blocked.
    }
    return { ...initial, activeFloorId };
  });
  const rememberFloor = useCallback(
    (id: string) => {
      try {
        if (storageKey) window.localStorage.setItem(storageKey, id);
      } catch {
        // A local preference must never prevent floor selection.
      }
    },
    [storageKey],
  );
  const views = useRef(new Map<string, unknown>());
  return useMemo(() => ({ state, setState, views, rememberFloor }), [state, rememberFloor]);
};
const FloorNavigationContext = createContext<ReturnType<typeof useNavigationState> | null>(null);
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
  const value = useNavigationState(initialFloorId, storageKey);
  return (
    <FloorNavigationContext.Provider value={value}>{children}</FloorNavigationContext.Provider>
  );
}

/** Standalone fixtures have local state; routed product shares the provider above routes. */
export function useFloorNavigation(floors: readonly { id: string; belowGround?: boolean }[]) {
  const shared = useContext(FloorNavigationContext);
  const local = useNavigationState();
  const { state, setState, views, rememberFloor } = shared ?? local;
  const order = floors.map((floor) => floor.id);
  const previousOrder = useRef(order);
  const selected = reconcileFloorSelection(
    state.activeFloorId &&
      (order.includes(state.activeFloorId) || previousOrder.current.includes(state.activeFloorId))
      ? state
      : { ...state, activeFloorId: floors.find((floor) => !floor.belowGround)?.id ?? "" },
    previousOrder.current,
    order,
  );
  useEffect(() => {
    previousOrder.current = order;
    if (selected.activeFloorId !== state.activeFloorId)
      setState((value) => ({ ...value, ...selected }));
  }, [order, selected, state.activeFloorId, setState]);
  const selectFloor = useCallback(
    (id: string, source: FloorSelectionSource = "target") => {
      if (!id) return;
      if (source === "picker") rememberFloor(id);
      setState((value) => ({
        activeFloorId: id,
        wholeBuilding: false,
        source,
        request: value.request + (source === "walk" ? 0 : 1),
      }));
    },
    [setState, rememberFloor],
  );
  return {
    ...state,
    ...selected,
    selectFloor,
    setWholeBuilding: (wholeBuilding: boolean) =>
      setState((value) => ({ ...value, wholeBuilding })),
    views: views.current,
  };
}
