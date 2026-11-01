import { editSceneItem, type SceneItemPatch } from "./item-edits";
export { normalizeSizeForPolicy } from "./item-edits";
import type {
  EntityBindingSlotSpec,
  FloorSpec,
  FurnishingItemSpec,
  FurnishingModelDefinition,
  ItemPlacement,
  PlanPoint,
  SceneItemSpec,
  SceneItemSize,
  SceneModelEditorDescriptor,
} from "@cabane/engine";
import { pointInsidePolygon, resolveItemTransform } from "@cabane/engine";
import { windowPlacements } from "./placement/window-placement";
import { placementNearWallsForWorldDrag } from "./placement/wall-drag-placement";

import { duplicateSceneItem } from "./duplicate-item";
import { createSceneItemId } from "./scene-item-identity";
import { expandItemSelection } from "./item-groups";
import { editFurnishingSelection, type FurnishingSelectionAction } from "./selection-operations";

export const snapToGrid = (value: number, gridMeters = 0.1) =>
  Math.round(value / gridMeters) * gridMeters;

export const planPointForWorldDrag = (
  world: { x: number; z: number },
  coordinates: { origin: PlanPoint; metersPerPlanUnit: number },
  raw: boolean,
  gridMeters = 0.1,
): PlanPoint => {
  const worldX = raw ? world.x : snapToGrid(world.x, gridMeters);
  const worldZ = raw ? world.z : snapToGrid(world.z, gridMeters);
  return [
    worldX / coordinates.metersPerPlanUnit + coordinates.origin[0],
    worldZ / coordinates.metersPerPlanUnit + coordinates.origin[1],
  ];
};

export const placementForWorldDrag = ({
  world,
  item,
  definition,
  floor,
  raw,
  wallSnapDistanceMeters = 0.55,
}: {
  world: { x: number; z: number };
  item: SceneItemSpec;
  definition: SceneModelEditorDescriptor;
  floor: FloorSpec;
  raw: boolean;
  wallSnapDistanceMeters?: number;
}): ItemPlacement => {
  const currentTransform = resolveItemTransform(item.placement, floor);
  const at = planPointForWorldDrag(world, floor.coordinates, raw);

  const rawAt = planPointForWorldDrag(world, floor.coordinates, true);
  const outdoor = definition.placementEnvironment === "outdoor";
  if (!raw && !outdoor && definition.windowFit) {
    const window = windowPlacements(definition, floor, rawAt, item.size)[0];
    if (window && window.distanceMeters <= wallSnapDistanceMeters) return window.placement;
  }
  if (!raw && !outdoor) {
    const wallPlacement = placementNearWallsForWorldDrag({
      rawAt,
      item,
      definition,
      floor,
      wallSnapDistanceMeters,
    });
    if (wallPlacement) return wallPlacement;
  }

  const ceilingRoomId = item.placement.kind === "ceiling" ? item.placement.roomId : null;
  if (
    item.placement.kind === "ceiling" &&
    floor.rooms.some((room) => room.id === ceilingRoomId && pointInsidePolygon(at, room.polygon))
  )
    return { ...item.placement, at };

  return {
    kind: "absolute",
    at,
    elevationMeters: currentTransform.position[1],
    rotationYRadians: currentTransform.rotationYRadians,
  };
};

export interface SelectionBoxGeometry {
  center: readonly [number, number, number];
  size: SceneItemSize;
}

export const selectionBoxGeometry = (
  item: Pick<SceneItemSpec, "size">,
  definition: SceneModelEditorDescriptor,
  paddingMeters = 0,
): SelectionBoxGeometry => {
  const scale = item.size.map((value, axis) => value / definition.defaultSize[axis]);
  const scaledMin = definition.bounds.min.map((value, axis) => value * scale[axis]);
  const scaledMax = definition.bounds.max.map((value, axis) => value * scale[axis]);
  return {
    center: scaledMin.map((value, axis) => (value + scaledMax[axis]) / 2) as unknown as readonly [
      number,
      number,
      number,
    ],
    size: scaledMin.map((value, axis) =>
      Math.max(0.04, scaledMax[axis] - value + paddingMeters * 2),
    ) as unknown as SceneItemSize,
  };
};

interface EditorSnapshot {
  items: readonly SceneItemSpec[];
  selectedId: string | null;
  multipleIds: readonly string[];
}

export interface FurnishingEditorState extends EditorSnapshot {
  placementError: string | null;
  past: readonly EditorSnapshot[];
  future: readonly EditorSnapshot[];
  transaction: EditorSnapshot | null;
}

export type FurnishingEditorAction =
  | {
      type: "update-item";
      id: string;
      patch: SceneItemPatch;
      definition: SceneModelEditorDescriptor;
    }
  | FurnishingSelectionAction
  | { type: "select-many"; ids: readonly string[] }
  | {
      type: "update-color";
      id: string;
      color: string | null;
      definition: SceneModelEditorDescriptor;
    }
  | { type: "add-item"; item: SceneItemSpec }
  | { type: "select"; id: string | null }
  | { type: "begin-transaction" }
  | { type: "commit-transaction" }
  | { type: "cancel-transaction" }
  | { type: "update-entity-slots"; id: string; entitySlots: readonly EntityBindingSlotSpec[] }
  | { type: "update-variant"; id: string; variant: string; definition: SceneModelEditorDescriptor }
  | {
      type: "update-light-state";
      id: string;
      lightState: "always-off" | "always-on" | "night-only" | "connected";
    }
  | { type: "update-placements"; placements: Readonly<Record<string, ItemPlacement>> }
  | { type: "update-placement"; id: string; placement: ItemPlacement }
  | { type: "update-size"; id: string; size: SceneItemSize; definition: SceneModelEditorDescriptor }
  | {
      type: "update-placement-and-size";
      id: string;
      placement: ItemPlacement;
      size: SceneItemSize;
      definition: SceneModelEditorDescriptor;
    }
  | { type: "rotate"; id: string; rotationYRadians: number }
  | { type: "duplicate"; id: string; floor?: FloorSpec; reservedSlotIds?: readonly string[] }
  | { type: "delete"; id: string }
  | { type: "delete-items"; ids: readonly string[] }
  | {
      type: "add-preset";
      floorId: string;
      modelId: string;
      definition: FurnishingModelDefinition;
      planCenter: PlanPoint;
      placement?: ItemPlacement;
    }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace-items"; items: readonly SceneItemSpec[]; selectedId?: string | null };

export const createFurnishingEditorState = (
  items: readonly SceneItemSpec[],
): FurnishingEditorState => ({
  items: [...items],
  selectedId: null,
  multipleIds: [],
  placementError: null,
  past: [],
  future: [],
  transaction: null,
});

const snapshot = (state: FurnishingEditorState): EditorSnapshot => ({
  items: state.items,
  selectedId: state.selectedId,
  multipleIds: state.multipleIds,
});

const withChange = (
  state: FurnishingEditorState,
  change: Pick<FurnishingEditorState, "items" | "selectedId"> &
    Partial<Pick<FurnishingEditorState, "multipleIds">>,
): FurnishingEditorState => ({
  ...state,
  multipleIds: [],
  ...change,
  past: state.transaction ? state.past : [...state.past, snapshot(state)],
  future: state.transaction ? state.future : [],
});

const updateItem = (
  state: FurnishingEditorState,
  id: string,
  update: (item: SceneItemSpec) => SceneItemSpec,
) => {
  let found = false;
  const items = state.items.map((item) => {
    if (item.id !== id || item.group) return item;
    const next = update(item);
    if (JSON.stringify(next) === JSON.stringify(item)) return item;
    found = true;
    return next;
  });
  return found ? withChange(state, { items, selectedId: id }) : state;
};

const rotationPlacement = (placement: ItemPlacement, rotationYRadians: number): ItemPlacement => {
  if (placement.kind === "absolute") return { ...placement, rotationYRadians };
  if (placement.kind === "ceiling") return { ...placement, rotationYRadians };
  return { ...placement, rotationOffsetRadians: rotationYRadians };
};

const presetPlacement = (
  _definition: FurnishingModelDefinition,
  planCenter: PlanPoint,
  explicit?: ItemPlacement,
): ItemPlacement => {
  if (explicit) return explicit;
  return {
    kind: "absolute",
    at: planCenter,
    elevationMeters: 0,
    rotationYRadians: 0,
  };
};

export const furnishingEditorReducer = (
  state: FurnishingEditorState,
  action: FurnishingEditorAction,
): FurnishingEditorState => {
  switch (action.type) {
    case "add-item":
      return withChange(state, {
        items: [...state.items, action.item],
        selectedId: action.item.id,
      });
    case "replace-items":
      return {
        ...createFurnishingEditorState(action.items),
        selectedId: action.selectedId ?? null,
      };
    case "select":
      return state.selectedId === action.id && !state.multipleIds.length
        ? state
        : { ...state, selectedId: action.id, multipleIds: [] };
    case "select-many":
      return {
        ...state,
        selectedId: action.ids.length === 1 ? action.ids[0] : null,
        multipleIds: action.ids,
      };
    case "group-items":
    case "ungroup-items":
    case "rename-group":
    case "transform-group":
    case "duplicate-items": {
      const change = editFurnishingSelection(state.items, action);
      return change ? withChange(state, change) : state;
    }
    case "begin-transaction":
      return state.transaction ? state : { ...state, transaction: snapshot(state) };
    case "commit-transaction":
      if (!state.transaction) return state;
      if (
        state.transaction.items === state.items &&
        state.transaction.selectedId === state.selectedId &&
        state.transaction.multipleIds === state.multipleIds
      ) {
        return { ...state, transaction: null };
      }
      return {
        ...state,
        past: [...state.past, state.transaction],
        future: [],
        transaction: null,
      };
    case "cancel-transaction":
      return state.transaction ? { ...state, ...state.transaction, transaction: null } : state;
    case "update-item":
      return updateItem(state, action.id, (item) =>
        editSceneItem(item, action.patch, action.definition),
      );
    case "update-color":
      return furnishingEditorReducer(state, {
        type: "update-item",
        id: action.id,
        patch: { color: action.color },
        definition: action.definition,
      });
    case "update-variant":
      return furnishingEditorReducer(state, {
        type: "update-item",
        id: action.id,
        patch: { variant: action.variant },
        definition: action.definition,
      });
    case "update-entity-slots":
      return updateItem(state, action.id, (item) => ({ ...item, entitySlots: action.entitySlots }));
    case "update-light-state":
      return updateItem(state, action.id, (item) =>
        item.kind === "device" || item.lightSlotId
          ? { ...item, lightState: action.lightState }
          : item,
      );
    case "update-placements": {
      const ids = new Set(Object.keys(action.placements));
      if (expandItemSelection(state.items, [...ids]).some((id) => !ids.has(id))) return state;
      const items = state.items.map((item) => {
        const placement = action.placements[item.id];
        return placement && JSON.stringify(placement) !== JSON.stringify(item.placement)
          ? { ...item, placement }
          : item;
      });
      return items.some((item, index) => item !== state.items[index])
        ? withChange(state, { items, selectedId: state.selectedId, multipleIds: state.multipleIds })
        : state;
    }
    case "update-placement":
      return updateItem(state, action.id, (item) => ({ ...item, placement: action.placement }));
    case "update-size":
    case "update-placement-and-size":
      return furnishingEditorReducer(state, {
        type: "update-item",
        id: action.id,
        definition: action.definition,
        patch: {
          size: action.size,
          ...(action.type === "update-placement-and-size" ? { placement: action.placement } : {}),
        },
      });
    case "rotate":
      return updateItem(state, action.id, (item) => ({
        ...item,
        placement: rotationPlacement(item.placement, action.rotationYRadians),
      }));
    case "duplicate": {
      const source = state.items.find((item) => item.id === action.id);
      if (!source) return state;
      if (source.group)
        return action.floor
          ? furnishingEditorReducer(state, {
              type: "duplicate-items",
              ids: [source.id],
              floor: action.floor,
              reservedIds: action.reservedSlotIds ?? [],
            })
          : state;
      const item = duplicateSceneItem(source, state.items, action.floor, action.reservedSlotIds);
      return withChange(state, { items: [...state.items, item], selectedId: item.id });
    }
    case "delete-items": {
      const ids = new Set(expandItemSelection(state.items, action.ids));
      const items = state.items.filter((item) => !ids.has(item.id));
      if (items.length === state.items.length) return state;
      return withChange(state, {
        items,
        selectedId: state.selectedId && ids.has(state.selectedId) ? null : state.selectedId,
        multipleIds: state.multipleIds.filter((id) => !ids.has(id)),
      });
    }
    case "delete": {
      if (state.items.find((item) => item.id === action.id)?.group)
        return furnishingEditorReducer(state, { type: "delete-items", ids: [action.id] });
      const index = state.items.findIndex((item) => item.id === action.id);
      if (index < 0) return state;
      const items = state.items.filter((item) => item.id !== action.id);
      const selectedId = state.selectedId === action.id ? null : state.selectedId;
      return withChange(state, { items, selectedId });
    }
    case "add-preset": {
      const id = createSceneItemId(
        state.items.flatMap((item) => [
          item.id,
          ...(item.entitySlots ?? []).map((slot) => slot.id),
        ]),
      );
      const item: FurnishingItemSpec = {
        id,
        kind: "furnishing",
        floorId: action.floorId,
        modelId: action.modelId,
        placement: presetPlacement(action.definition, action.planCenter, action.placement),
        size: [...action.definition.defaultSize],
      };
      return withChange(state, { items: [...state.items, item], selectedId: id });
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
        transaction: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
        transaction: null,
      };
    }
  }
};
