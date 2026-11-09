import {
  floorZonePointWithinRoom,
  floorZoneWithinRoom,
  groundZoneOutsideFootprint,
  groundZonePointOutsideFootprint,
  isFloorZoneOutline,
  type FloorSpec,
  type PlanPoint,
  type Polygon,
} from "@cabane/engine";
import { useCallback, useRef, useState } from "react";

export interface FloorZoneDrawingState {
  roomId: string | null;
  points: readonly PlanPoint[];
  future: readonly PlanPoint[];
  preview: PlanPoint | null;
  error: string | null;
}

export const emptyFloorZoneDrawing: FloorZoneDrawingState = {
  roomId: null,
  points: [],
  future: [],
  preview: null,
  error: null,
};

export type FloorZoneDrawingAction =
  | { type: "point"; point: PlanPoint }
  | { type: "preview"; point: PlanPoint }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "cancel" };

const same = (left: PlanPoint, right: PlanPoint) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= 1e-7;

/** Boundary points retain every possible owner until the outline chooses a side. */
export const floorAreaDrawingOwners = (
  points: readonly PlanPoint[],
  floor: Pick<FloorSpec, "footprint" | "footprintRegions" | "rooms">,
) => ({
  rooms: floor.rooms.filter((room) =>
    points.every((point) => floorZonePointWithinRoom(point, room.polygon)),
  ),
  outdoor: points.every((point) => groundZonePointOutsideFootprint(point, floor)),
});
const drawingRoomId = (
  points: readonly PlanPoint[],
  floor: Pick<FloorSpec, "footprint" | "footprintRegions" | "rooms">,
) => {
  const owners = floorAreaDrawingOwners(points, floor);
  return !owners.outdoor && owners.rooms.length === 1 ? owners.rooms[0].id : null;
};

export const advanceFloorZoneDrawing = (
  state: FloorZoneDrawingState,
  action: FloorZoneDrawingAction,
  floor: Pick<FloorSpec, "footprint" | "footprintRegions" | "rooms">,
): {
  state: FloorZoneDrawingState;
  completed?: { roomId: string | null; polygon: Polygon };
} => {
  if (action.type === "cancel") return { state: emptyFloorZoneDrawing };
  if (action.type === "preview") {
    return { state: { ...state, preview: action.point } };
  }
  if (action.type === "undo") {
    if (!state.points.length) return { state };
    const points = state.points.slice(0, -1);
    return {
      state: {
        roomId: points.length ? drawingRoomId(points, floor) : null,
        points,
        future: [state.points.at(-1)!, ...state.future],
        preview: null,
        error: null,
      },
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return { state };
    return {
      state: {
        ...state,
        roomId: drawingRoomId([...state.points, state.future[0]], floor),
        points: [...state.points, state.future[0]],
        future: state.future.slice(1),
        preview: state.future[0],
        error: null,
      },
    };
  }
  const point = action.point;
  const rooms = floor.rooms;
  if (!point.every(Number.isFinite)) return { state };
  if (state.points.length && same(point, state.points.at(-1)!)) return { state };
  const owners = floorAreaDrawingOwners([...state.points, point], floor);
  const room = owners.rooms[0];
  if (state.points.length >= 3 && same(point, state.points[0])) {
    const polygon = state.points as Polygon;
    if (!isFloorZoneOutline(polygon)) {
      return {
        state: {
          ...state,
          error: "The area crosses itself or has no area.",
        },
      };
    }
    if (room && !floorZoneWithinRoom(polygon, room.polygon)) {
      return {
        state: {
          ...state,
          error: `Keep the complete area inside ${room.name}.`,
        },
      };
    }
    if (!room && !groundZoneOutsideFootprint(polygon, floor)) {
      return {
        state: {
          ...state,
          error: "Keep the complete outdoor area outside the building.",
        },
      };
    }
    return {
      state: emptyFloorZoneDrawing,
      completed: { roomId: room?.id ?? null, polygon },
    };
  }
  if (!room && !owners.outdoor) {
    const previousRoom = rooms.find((candidate) => candidate.id === state.roomId);
    return {
      state: {
        ...state,
        error: !state.points.length
          ? "Start inside a room or outside the building."
          : previousRoom
            ? `Keep every corner inside ${previousRoom.name}.`
            : "Keep every outdoor corner outside the building, or keep the area inside one room.",
      },
    };
  }
  if (state.points.some((candidate) => same(candidate, point))) {
    return {
      state: {
        ...state,
        error: "Return to the first corner to close the area.",
      },
    };
  }
  return {
    state: {
      ...state,
      roomId: drawingRoomId([...state.points, point], floor),
      points: [...state.points, point],
      future: [],
      preview: point,
      error: null,
    },
  };
};

export function useFloorZoneDrawing(
  floor: Pick<FloorSpec, "footprint" | "footprintRegions" | "rooms">,
  onComplete: (roomId: string | null, polygon: Polygon) => void,
) {
  const [state, setState] = useState(emptyFloorZoneDrawing);
  const current = useRef(state);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const dispatch = useCallback(
    (action: FloorZoneDrawingAction) => {
      const next = advanceFloorZoneDrawing(current.current, action, floor);
      current.current = next.state;
      setState(next.state);
      if (next.completed) {
        complete.current(next.completed.roomId, next.completed.polygon);
      }
    },
    [floor],
  );
  return {
    ...state,
    active: state.points.length > 0 || state.future.length > 0,
    place: useCallback((point: PlanPoint) => dispatch({ type: "point", point }), [dispatch]),
    previewPoint: useCallback(
      (point: PlanPoint) => dispatch({ type: "preview", point }),
      [dispatch],
    ),
    undo: useCallback(() => dispatch({ type: "undo" }), [dispatch]),
    redo: useCallback(() => dispatch({ type: "redo" }), [dispatch]),
    cancel: useCallback(() => dispatch({ type: "cancel" }), [dispatch]),
  };
}
