import { composeHomeProjectPreview, deriveFloorLevels } from "@cabane/engine";

import { evaluateDerivedWalkNavigation } from "@cabane/engine";

import { useMemo } from "react";

import { useConstructEditor } from "../editor-preview/construct";

import { useSceneItemDependencies } from "../editor-preview/construct/useSceneItemDependencies";

import { useFurnishingEditor } from "../editor-preview/furnish";

import { projectFromEditorState } from "../editor-preview/project-sync";

import { editorBindingsForManifest, ownerProjectExtensions } from "../project-runtime";

import type { HomeProject, ProjectModelRegistries } from "@cabane/engine";
import { missingModelEditorDescriptor } from "../editor-preview/furnish/missing-model";
type Options = {
  project: HomeProject;
  constructEditor: ReturnType<typeof useConstructEditor>;
  furnishingEditor: ReturnType<typeof useFurnishingEditor>;
  activeFloorId: string;
  registries: ProjectModelRegistries;
};
export function useEditorSceneProjection({
  project,
  constructEditor,
  furnishingEditor,
  activeFloorId,
  registries,
}: Options) {
  const { previewFloor: constructEditorPreviewFloor, wallRuns: constructEditorWallRuns } =
    constructEditor;
  const {
    transaction: furnishingEditorTransaction,
    items: furnishingEditorItems,
    selectedId: furnishingEditorSelectedId,
  } = furnishingEditor;
  const { furnishingModels, deviceModels } = registries;
  const ceilingDependencies = useSceneItemDependencies(
    furnishingEditor,
    constructEditorPreviewFloor,
    constructEditorWallRuns,
  );
  const previewSceneItems = ceilingDependencies.items;
  const visualSceneItems = furnishingEditorTransaction ? furnishingEditorItems : previewSceneItems;
  const selectedItem =
    !furnishingEditor.selectedGroup && furnishingEditor.selectedIds.length <= 1
      ? visualSceneItems.find((item) => item.id === furnishingEditorSelectedId)
      : undefined;
  const selectedDefinition =
    selectedItem &&
    ((selectedItem.kind === "device" ? deviceModels : furnishingModels)[selectedItem.modelId] ??
      missingModelEditorDescriptor(selectedItem));
  const walkNavigation = useMemo(
    () => evaluateDerivedWalkNavigation(constructEditorPreviewFloor),
    [constructEditorPreviewFloor],
  );
  const editorProject = useMemo(
    () => projectFromEditorState(project, constructEditorPreviewFloor, previewSceneItems),
    [constructEditorPreviewFloor, previewSceneItems, project],
  );
  const editorProjectJson = useMemo(() => JSON.stringify(editorProject), [editorProject]);
  const editedManifest = useMemo(
    () => composeHomeProjectPreview(editorProject, ownerProjectExtensions).manifest,
    [editorProject],
  );
  const placementFloor = useMemo(
    () => ({
      ...constructEditorPreviewFloor,
      elevationMeters:
        deriveFloorLevels(project.floors).find((level) => level.floorId === activeFloorId)
          ?.elevationMeters ?? 0,
    }),
    [constructEditorPreviewFloor, project.floors, activeFloorId],
  );
  // Device additions/duplicates need a typed preview slot, but moving an item
  // must not recreate every device's binding props. No live entities are used.
  const editorBindingKey = JSON.stringify(
    editedManifest.floors
      .flatMap((floor) => floor.rooms)
      .map((room) => [
        room.id,
        room.name,
        room.devices.map(({ id, model, entitySlots }) => ({ id, model, entitySlots })),
      ]),
  );
  const editorResolvedBindings = useMemo(
    () => editorBindingsForManifest(editedManifest),
    // The key captures room and device slot identity; moving furniture must preserve preview binding objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorBindingKey],
  );
  const visualManifest = useMemo(
    () =>
      visualSceneItems === editedManifest.sceneItems
        ? editedManifest
        : {
            ...editedManifest,
            sceneItems: [
              ...editedManifest.sceneItems.filter((item) => item.floorId !== activeFloorId),
              ...visualSceneItems,
            ],
          },
    [activeFloorId, editedManifest, visualSceneItems],
  );
  return {
    furnishingModels,
    deviceModels,
    ceilingDependencies,
    previewSceneItems,
    visualSceneItems,
    selectedItem,
    selectedDefinition,
    walkNavigation,
    editorProject,
    editorProjectJson,
    editedManifest,
    placementFloor,
    editorResolvedBindings,
    visualManifest,
  };
}
