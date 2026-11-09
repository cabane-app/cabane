import { useLayoutEffect, useMemo, useRef } from "react";
import { localSurfaceAt, type DerivedWallRun, type FloorSpec } from "@cabane/engine";
import type { FurnishingEditorController } from "../furnish/useFurnishingEditor";
import {
  reconcileSceneItemCeilingDependencies,
  reconcileSceneItemWallDependencies,
} from "./scene-item-dependencies";

/** Shares resolved support placements between construction and Arrange. */
export const useSceneItemDependencies = (
  editor: FurnishingEditorController,
  floor: FloorSpec,
  wallRuns: readonly DerivedWallRun[],
) => {
  const {
    transaction: editorTransaction,
    items: editorItems,
    selectedId: editorSelectedId,
    replaceItems: editorReplaceItems,
  } = editor;
  const rememberedWalls = useRef(new Map(floor.walls.map((wall) => [wall.id, wall])));
  const rememberedFloor = useRef(floor);
  const sourceItems = editorTransaction?.items ?? editorItems;
  const items = useMemo(
    () =>
      sourceItems.map((item) => {
        const p = item.placement;
        if (p.kind !== "absolute" || p.surfaceRelative || floor === rememberedFloor.current)
          return item;
        const before = localSurfaceAt(rememberedFloor.current, p.at);
        const after = localSurfaceAt(floor, p.at);
        if (
          before.id === after.id ||
          after.id === floor.id ||
          Math.abs(p.elevationMeters - before.elevation) > 0.05
        )
          return item;
        return {
          ...item,
          placement: {
            ...p,
            surfaceRelative: true,
            elevationMeters: p.elevationMeters - before.elevation,
          },
        };
      }),
    [sourceItems, floor],
  );
  const wallItems = useMemo(
    () => reconcileSceneItemWallDependencies(items, floor, rememberedWalls.current, wallRuns),
    [items, floor, wallRuns],
  );
  const dependencies = useMemo(
    () => reconcileSceneItemCeilingDependencies(wallItems, floor),
    [wallItems, floor],
  );

  useLayoutEffect(() => {
    if (editorTransaction) return;
    rememberedFloor.current = floor;
    floor.walls.forEach((wall) => rememberedWalls.current.set(wall.id, wall));
    if (
      dependencies.items.length === editorItems.length &&
      dependencies.items.every((item, index) => item === editorItems[index])
    )
      return;
    // The mutable Arrange state (including the next drag/cancel snapshot) must
    // use the same placements as the preview. Shared workspace history records
    // the support change together with the architecture, not as a second edit.
    const selectedId = dependencies.items.some((item) => item.id === editorSelectedId)
      ? editorSelectedId
      : null;
    editorReplaceItems(dependencies.items, selectedId);
  }, [
    floor,
    dependencies.items,
    editorItems,
    editorTransaction,
    editorSelectedId,
    editorReplaceItems,
  ]);

  return dependencies;
};
