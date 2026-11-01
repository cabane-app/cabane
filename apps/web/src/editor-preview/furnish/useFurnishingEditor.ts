import type { SceneItemPatch } from "./item-edits";
import { useCallback, useMemo, useReducer } from "react";
import { collectProjectIds } from "@cabane/engine";
import type {
  EntityBindingSlotSpec,
  FloorSpec,
  HomeProject,
  ProjectModelRegistries,
  FurnishingModelDefinition,
  ItemPlacement,
  PlanPoint,
  SceneItemSpec,
  SceneItemSize,
  SceneModelEditorDescriptor,
} from "@cabane/engine";
import {
  createFurnishingEditorState,
  type FurnishingEditorState,
  type FurnishingEditorAction,
} from "./editor-state";
import { guardedFurnishingEditorReducer } from "./placement/guarded-editor-state";
import { expandItemSelection, selectedItemGroup } from "./item-groups";

export const useFurnishingEditor = (
  initialItems: readonly SceneItemSpec[],
  context?: {
    project: HomeProject;
    floor: FloorSpec;
    registries: ProjectModelRegistries;
  },
) => {
  const floors = context?.project.floors;
  const floor = context?.floor;
  const registries = context?.registries;
  const validation = useMemo(
    () =>
      floors && floor && registries
        ? {
            project: {
              floors: floors.map((candidate) => (candidate.id === floor.id ? floor : candidate)),
            },
            registries,
          }
        : undefined,
    [floors, floor, registries],
  );
  const [state, dispatch] = useReducer(
    (state: FurnishingEditorState, action: FurnishingEditorAction) =>
      guardedFurnishingEditorReducer(state, action, validation),
    initialItems,
    createFurnishingEditorState,
  );
  const selectedIds = useMemo(
    () =>
      expandItemSelection(state.items, state.selectedId ? [state.selectedId] : state.multipleIds),
    [state.items, state.selectedId, state.multipleIds],
  );
  const selectedGroup = selectedItemGroup(state.items, selectedIds);
  const selectedItem =
    !selectedGroup && selectedIds.length === 1
      ? (state.items.find((item) => item.id === selectedIds[0]) ?? null)
      : null;

  return {
    ...state,
    selectedId: selectedGroup ? selectedIds[0] : state.selectedId,
    selectedGroup,
    selectedIds,
    selectMany: useCallback((ids: string[]) => {
      dispatch({ type: "select-many", ids });
    }, []),
    groupItems: (ids: readonly string[]) =>
      dispatch({
        type: "group-items",
        ids,
        reservedIds: context ? collectProjectIds(context.project) : [],
      }),
    ungroupItems: (ids: readonly string[]) => dispatch({ type: "ungroup-items", ids }),
    duplicateItems: (ids: readonly string[], floor: FloorSpec) =>
      dispatch({
        type: "duplicate-items",
        ids,
        floor,
        reservedIds: context ? collectProjectIds(context.project) : [],
      }),
    groupSelection: () =>
      dispatch({
        type: "group-items",
        ids: selectedIds,
        reservedIds: context ? collectProjectIds(context.project) : [],
      }),
    ungroupSelection: () => dispatch({ type: "ungroup-items", ids: selectedIds }),
    renameGroup: (id: string, name: string) => dispatch({ type: "rename-group", id, name }),
    transformGroup: (
      id: string,
      placement: Extract<ItemPlacement, { kind: "absolute" }>,
      floor: FloorSpec,
    ) => dispatch({ type: "transform-group", id, placement, floor }),
    duplicateSelection: (
      floor: FloorSpec,
      reservedIds: readonly string[] = context ? collectProjectIds(context.project) : [],
    ) => dispatch({ type: "duplicate-items", ids: selectedIds, floor, reservedIds }),
    addItem: useCallback((item: SceneItemSpec) => dispatch({ type: "add-item", item }), []),
    selectedItem,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    select: useCallback((id: string | null) => {
      dispatch({ type: "select", id });
    }, []),
    beginTransaction: useCallback(() => dispatch({ type: "begin-transaction" }), []),
    commitTransaction: useCallback(() => dispatch({ type: "commit-transaction" }), []),
    cancelTransaction: useCallback(() => dispatch({ type: "cancel-transaction" }), []),
    updateItem: (id: string, patch: SceneItemPatch, definition: SceneModelEditorDescriptor) =>
      dispatch({ type: "update-item", id, patch, definition }),
    updateColor: useCallback(
      (id: string, color: string | null, definition: SceneModelEditorDescriptor) =>
        dispatch({ type: "update-color", id, color, definition }),
      [],
    ),
    updateVariant: useCallback(
      (id: string, variant: string, definition: SceneModelEditorDescriptor) =>
        dispatch({ type: "update-variant", id, variant, definition }),
      [],
    ),
    updateEntitySlots: useCallback(
      (id: string, entitySlots: readonly EntityBindingSlotSpec[]) =>
        dispatch({ type: "update-entity-slots", id, entitySlots }),
      [],
    ),
    updateLightState: useCallback(
      (id: string, lightState: "always-off" | "always-on" | "night-only" | "connected") =>
        dispatch({ type: "update-light-state", id, lightState }),
      [],
    ),
    updatePlacements: useCallback(
      (placements: Readonly<Record<string, ItemPlacement>>) =>
        dispatch({ type: "update-placements", placements }),
      [],
    ),
    updatePlacement: useCallback(
      (id: string, placement: ItemPlacement) =>
        dispatch({ type: "update-placement", id, placement }),
      [],
    ),
    updateSize: useCallback(
      (id: string, size: SceneItemSize, definition: SceneModelEditorDescriptor) =>
        dispatch({ type: "update-size", id, size, definition }),
      [],
    ),
    updatePlacementAndSize: useCallback(
      (
        id: string,
        placement: ItemPlacement,
        size: SceneItemSize,
        definition: SceneModelEditorDescriptor,
      ) => dispatch({ type: "update-placement-and-size", id, placement, size, definition }),
      [],
    ),
    rotate: useCallback(
      (id: string, rotationYRadians: number) => dispatch({ type: "rotate", id, rotationYRadians }),
      [],
    ),
    duplicate: useCallback(
      (id: string, floor?: FloorSpec, reservedSlotIds?: readonly string[]) =>
        dispatch({
          type: "duplicate",
          id,
          ...(floor === undefined ? {} : { floor: floor }),
          ...(reservedSlotIds === undefined ? {} : { reservedSlotIds: reservedSlotIds }),
        }),
      [],
    ),
    deleteItems: useCallback(
      (ids: readonly string[]) => dispatch({ type: "delete-items", ids }),
      [],
    ),
    deleteItem: useCallback((id: string) => dispatch({ type: "delete", id }), []),
    addPreset: useCallback(
      (
        floorId: string,
        modelId: string,
        definition: FurnishingModelDefinition,
        planCenter: PlanPoint,
        placement?: ItemPlacement,
      ) =>
        dispatch({
          type: "add-preset",
          floorId,
          modelId,
          definition,
          planCenter,
          ...(placement === undefined ? {} : { placement: placement }),
        }),
      [],
    ),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    replaceItems: useCallback((items: readonly SceneItemSpec[], selectedId?: string | null) => {
      dispatch({
        type: "replace-items",
        items,
        ...(selectedId === undefined ? {} : { selectedId: selectedId }),
      });
    }, []),
  };
};

export type FurnishingEditorController = ReturnType<typeof useFurnishingEditor>;
