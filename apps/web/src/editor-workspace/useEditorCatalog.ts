import type { ItemPlacement, PlanPoint } from "@cabane/engine";
import { collectProjectIds, sceneItemPlacementIssues } from "@cabane/engine";
import { useEditorSceneProjection } from "./useEditorSceneProjection";

import { polygonCentroid } from "@cabane/engine";

import { useCallback, useRef, useState } from "react";

import { useFurnishingEditor } from "../editor-preview/furnish";

import { type CatalogBrowsing } from "../editor-preview/furnish/catalog/ArrangeCatalog";

import type { CatalogEntry } from "../editor-preview/furnish/catalog/catalog";

import { createCatalogItem } from "../editor-preview/furnish/placement/item-creation";

import { catalogStartPlacement } from "../editor-preview/furnish/placement/catalog-start-placement";

type Options = {
  projection: ReturnType<typeof useEditorSceneProjection>;
  furnishingEditor: ReturnType<typeof useFurnishingEditor>;
  disabled: boolean;
};
export function useEditorCatalog({ projection, furnishingEditor, disabled }: Options) {
  const { placementFloor, visualSceneItems, furnishingModels, deviceModels, editorProject } =
    projection;
  const { items: furnishingEditorItems, addItem: furnishingEditorAddItem } = furnishingEditor;
  const arrangeTarget = useRef<PlanPoint | null>(null);
  const arrangeVisibility = useRef<(position: readonly number[]) => boolean>(() => false);
  const handleCameraTargetChange = useCallback(
    (point: PlanPoint, isVisible: (position: readonly number[]) => boolean) => {
      arrangeTarget.current = point;
      arrangeVisibility.current = isVisible;
    },
    [],
  );

  const [catalogBrowsing, setCatalogBrowsing] = useState<CatalogBrowsing>({
    room: "all",
    query: "",
    view: "categories",
  });
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [arrangeAnnouncement, setArrangeAnnouncement] = useState("");
  const addCatalogItem = (
    entry: CatalogEntry,
    options?: { at?: PlanPoint; placement?: ItemPlacement },
  ) => {
    if (disabled) return { error: "The editor is busy." };

    const candidate = options?.placement
      ? { placement: options.placement, error: null, size: undefined }
      : catalogStartPlacement(
          entry,
          placementFloor,
          options?.at ?? arrangeTarget.current ?? polygonCentroid(placementFloor.footprint),
          { items: visualSceneItems, furnishingModels, deviceModels },
          arrangeVisibility.current,
        );
    setCatalogError(candidate.error);
    if (!candidate.placement)
      return { error: candidate.error ?? "No suitable placement was found." };
    const item = createCatalogItem(
      entry,
      candidate.placement,
      furnishingEditorItems,
      collectProjectIds(editorProject),
      placementFloor.id,
    );
    const placed = candidate.size ? { ...item, size: candidate.size } : item;
    const issue = sceneItemPlacementIssues(placed, editorProject, entry.definition)[0];
    if (issue) {
      setCatalogError(issue.message);
      return { error: issue.message };
    }
    furnishingEditorAddItem(placed);
    setArrangeAnnouncement(
      `${entry.definition.label} added. Drag to move it; use Undo to remove it.`,
    );
    return { itemId: placed.id };
  };

  return {
    catalogBrowsing,
    setCatalogBrowsing,
    catalogError,
    setCatalogError,
    arrangeAnnouncement,
    addCatalogItem,
    handleCameraTargetChange,
  };
}
