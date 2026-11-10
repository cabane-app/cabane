import { useState, type ReactNode } from "react";
import { ConstructionToolCards } from "../editor-chrome/ConstructionToolCards";
import type { CustomModel } from "@cabane/engine";
import { CustomModelLibrary } from "../custom-models/CustomModelLibrary";
import { CustomModelCard } from "../custom-models/CustomModelCard";
import type { ManifestIssue } from "@cabane/engine";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { EditorModeIntroduction } from "../editor-chrome/EditorModeIntroduction";
import { ConstructFloorControls, StairPlacementPanel } from "../editor-floors";
import { convertStairShape } from "../editor-floors/stair-placement-geometry";
import { isPristineConstructionFloor } from "../editor-preview/construct/contextual-validation";
import { ConstructionInspector } from "../editor-preview/construct";

import { ConnectSidebar } from "../editor-connect/ConnectSidebar";

import { ArrangePlacedItems } from "../editor-preview/furnish/ArrangePlacedItems";
import { ArrangeCatalog } from "../editor-preview/furnish/catalog/ArrangeCatalog";

import { useHomeEditorController } from "./useHomeEditorController";

type Props = Pick<
  ReturnType<typeof useHomeEditorController>,
  | "northOrientation"
  | "floorNavigation"
  | "activeFloorId"
  | "stairPlacement"
  | "startStairs"
  | "setStairPlacement"
  | "setFloorDialog"
  | "mode"
  | "cameraView"
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "connect"
  | "constructEditor"
  | "floorZoneDrawing"
  | "furnishingModels"
  | "deviceModels"
  | "floorPaintTarget"
  | "unsettled"
  | "onWorkspaces"
  | "runtime"
  | "reference"
  | "replaceEditorsFromProject"
  | "workspace"
  | "floorFinish"
  | "setFloorFinish"
  | "setFloorPaintTarget"
  | "homeAssistantUrl"
  | "snapshot"
  | "executeProjectAction"
  | "catalogBrowsing"
  | "setCatalogBrowsing"
  | "catalogError"
  | "addCatalogItem"
  | "furnishingEditor"
  | "placementFloor"
> & {
  onMobileToolChoose: () => void;
  onSelectPlacedItem: (id: string) => void;
  sidebar: React.RefObject<HTMLElement | null>;
  iconUrl: string;
  settingsMode: boolean;
  settingsNavigation: ReactNode;
  tutorialPanel: ReactNode;
  floorControlsDisabled: boolean;
  addFloorAbove: () => void;
  addFloorBelow: () => void;
  stairLiveIssues: readonly ManifestIssue[] | null;
  onHomeAssistantSettings: Parameters<typeof useHomeEditorController>[0]["onHomeAssistantSettings"];
};
export function EditorSidebar({
  northOrientation,
  floorNavigation,
  activeFloorId,
  stairPlacement,
  startStairs,
  setStairPlacement,
  setFloorDialog,
  mode,
  cameraView,
  editingLocked,
  publishOpen,
  previewOpen,
  connect,
  constructEditor,
  floorZoneDrawing,
  furnishingModels,
  deviceModels,
  floorPaintTarget,
  unsettled,
  onWorkspaces,
  workspace,
  replaceEditorsFromProject,
  runtime,
  reference,
  floorFinish,
  setFloorFinish,
  setFloorPaintTarget,
  homeAssistantUrl,
  snapshot,
  executeProjectAction,
  catalogBrowsing,
  setCatalogBrowsing,
  catalogError,
  addCatalogItem,
  furnishingEditor,
  placementFloor,
  onSelectPlacedItem,
  sidebar,
  iconUrl,
  settingsMode,
  settingsNavigation,
  tutorialPanel,
  floorControlsDisabled,
  addFloorAbove,
  addFloorBelow,
  stairLiveIssues,
  onHomeAssistantSettings,
  onMobileToolChoose,
}: Props) {
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
  const constructPreview = mode === "construct" && cameraView === "3d";
  return (
    <>
      <aside
        ref={sidebar}
        className="direction-rail"
        inert={editingLocked || publishOpen || previewOpen || northOrientation.active}
      >
        <div className="editor-sidebar-content">
          <div className="direction-rail__brand">
            <img src={iconUrl} alt="" width="43" height="51" />
            <div className="direction-rail__identity">
              <h1>Cabane</h1>
              {onWorkspaces && (
                <button
                  type="button"
                  className="editor-workspace-link"
                  title={`Switch workspace · ${snapshot.project.home.name}`}
                  aria-label={`Workspaces: ${snapshot.project.home.name}`}
                  disabled={editingLocked || unsettled}
                  onClick={onWorkspaces}
                >
                  <span>{snapshot.project.home.name}</span>
                  <EditorIcon name="chevron" />
                </button>
              )}
            </div>
          </div>
          {!settingsMode && mode === "construct" && (
            <ConstructFloorControls
              floors={snapshot.project.floors}
              selectedId={activeFloorId}
              disabled={floorControlsDisabled}
              onSelect={(id) => floorNavigation.selectFloor(id, "picker")}
              onAdd={addFloorAbove}
              onAddBelow={addFloorBelow}
              onSettings={() => setFloorDialog("rename")}
              apartmentFloor={snapshot.project.home.apartmentFloor ?? 0}
              onApartmentFloor={(apartmentFloor) =>
                executeProjectAction({ type: "update-home-settings", changes: { apartmentFloor } })
              }
            />
          )}
          <EditorModeIntroduction
            mode={settingsMode ? "settings" : mode}
            constructPreview={constructPreview}
          />
          {!settingsMode && mode === "construct" && (
            <ConstructionToolCards
              inert={editingLocked || unsettled || reference.adjusting}
              tool={constructPreview ? null : constructEditor.tool}
              stairsActive={Boolean(stairPlacement)}
              onToolChange={(tool) => {
                setStairPlacement(null);
                constructEditor.setTool(tool);
                onMobileToolChoose();
              }}
              onStairs={() => {
                startStairs();
              }}
            />
          )}
          {settingsMode && settingsNavigation}
          {!settingsMode && mode !== "construct" && tutorialPanel}
          {!settingsMode &&
            mode === "construct" &&
            !constructPreview &&
            !tutorialPanel &&
            isPristineConstructionFloor(constructEditor.previewFloor) && (
              <p className="construction-empty-hint">
                Your plan starts here. Choose Wall, then click each corner to draw your first room.
              </p>
            )}
          {!settingsMode && mode === "construct" && stairPlacement && (
            <StairPlacementPanel
              shape={stairPlacement.shape ?? "straight"}
              style={stairPlacement.style ?? "open"}
              onStyleChange={(style) => setStairPlacement({ ...stairPlacement, style })}
              sameFloor={Boolean(stairPlacement.terrain)}
              canConnectFloors={snapshot.project.floors.at(-1)?.id !== activeFloorId}
              onConnectionChange={startStairs}
              issues={stairLiveIssues ?? []}
              onChange={(shape) =>
                setStairPlacement(convertStairShape(snapshot.project, stairPlacement, shape))
              }
              onCancel={() => setStairPlacement(null)}
            />
          )}
          {!settingsMode && mode === "construct" && !stairPlacement && (
            <ConstructionInspector
              inert={reference.adjusting}
              editor={constructEditor}
              floorPainting={{
                finish: floorFinish,
                target: floorPaintTarget,
                drawingActive: floorZoneDrawing.active,
                drawingError: floorZoneDrawing.error,
                onFinishChange: setFloorFinish,
                onTargetChange: (target) => {
                  floorZoneDrawing.cancel();
                  setFloorPaintTarget(target);
                },
                onCancelDrawing: floorZoneDrawing.cancel,
              }}
            />
          )}
          {!settingsMode && mode === "connect" && (
            <ConnectSidebar
              editor={connect}
              runtime={runtime}
              homeAssistantUrl={homeAssistantUrl}
              onSettings={onHomeAssistantSettings}
            />
          )}
          <div className="arrange-catalog-mount" hidden={settingsMode || mode !== "furnish"}>
            <ArrangePlacedItems
              key={activeFloorId}
              floor={placementFloor}
              items={furnishingEditor.items}
              furnishingModels={furnishingModels}
              deviceModels={deviceModels}
              selectedIds={furnishingEditor.selectedIds}
              disabled={editingLocked || unsettled}
              onSelect={onSelectPlacedItem}
              onSelectMany={furnishingEditor.selectMany}
            />
            <ArrangeCatalog
              enabled={!settingsMode && mode === "furnish"}
              furnishingModels={furnishingModels}
              deviceModels={deviceModels}
              browsing={catalogBrowsing}
              onBrowse={setCatalogBrowsing}
              error={catalogError}
              onChoose={addCatalogItem}
              customModels={
                <CustomModelLibrary
                  workspace={workspace}
                  editingModel={editingModel}
                  onCloseEditor={() => setEditingModel(null)}
                  onEditSnapshot={(next) => {
                    replaceEditorsFromProject(next.project);
                    workspace.commit(next);
                  }}
                  disabled={editingLocked || unsettled}
                  onBrowse={() => setCatalogBrowsing({ room: "my-models", query: "" })}
                />
              }
              renderCustomModel={(entry) => (
                <CustomModelCard
                  workspace={workspace}
                  entry={entry}
                  disabled={editingLocked || unsettled}
                  onChoose={() => addCatalogItem(entry)}
                  onEdit={setEditingModel}
                />
              )}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
