import { useState, type ReactNode } from "react";
import { TerrainSettingsEditor } from "../editor-preview/construct/TerrainSettingsEditor";
import { ConstructionToolCards } from "../editor-chrome/ConstructionToolCards";
import type { CustomModel } from "@cabane/engine";
import { CustomModelLibrary } from "../custom-models/CustomModelLibrary";
import { CustomModelCard } from "../custom-models/CustomModelCard";
import type { ManifestIssue } from "@cabane/engine";
import { EditorButton } from "../editor-chrome/EditorButton";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { EditorModeIntroduction } from "../editor-chrome/EditorModeIntroduction";
import { SidebarSectionSummary } from "../editor-chrome/SidebarSectionSummary";
import { ConstructFloorControls, StairPlacementPanel } from "../editor-floors";
import { convertStairShape } from "../editor-floors/stair-placement-geometry";
import { BuildTutorial } from "../editor-onboarding/BuildTutorial";
import { useBuildTutorial } from "../editor-onboarding/useBuildTutorial";
import { PlanImportActions } from "../editor-plan-import/PlanImportActions";
import { isPristineConstructionFloor } from "../editor-preview/construct/contextual-validation";
import { ReferencePlanPanel } from "../editor-reference-plan/ReferencePlanPanel";

import { NorthSettingsEditor } from "../editor-preview/construct/NorthSettingsEditor";

import { ConstructionInspector } from "../editor-preview/construct";

import { ConnectSidebar } from "../editor-connect/ConnectSidebar";

import { ArrangePlacedItems } from "../editor-preview/furnish/ArrangePlacedItems";
import { ArrangeCatalog } from "../editor-preview/furnish/catalog/ArrangeCatalog";

import { useHomeEditorController } from "./useHomeEditorController";

const PLAN_IMPORT_ENABLED = false;

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
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "connect"
  | "clearConstructionSelection"
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
  floorControlsDisabled: boolean;
  addFloorAbove: () => void;
  addFloorBelow: () => void;
  tutorial: ReturnType<typeof useBuildTutorial>;
  tutorialBusy: boolean;
  activateTutorial: () => void;
  stairLiveIssues: readonly ManifestIssue[] | null;
  importWorkspace: (json: string) => void;
  placingWalkStart: boolean;
  setWalkStartFloor: React.Dispatch<React.SetStateAction<string | null>>;
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
  editingLocked,
  publishOpen,
  previewOpen,
  connect,
  clearConstructionSelection,
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
  floorControlsDisabled,
  addFloorAbove,
  addFloorBelow,
  tutorial,
  tutorialBusy,
  activateTutorial,
  stairLiveIssues,
  importWorkspace,
  placingWalkStart,
  setWalkStartFloor,
  onHomeAssistantSettings,
  onMobileToolChoose,
}: Props) {
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
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
              onSelect={(id) => floorNavigation.selectFloor(id)}
              onAdd={addFloorAbove}
              onAddBelow={addFloorBelow}
              onSettings={() => setFloorDialog("rename")}
              apartmentFloor={snapshot.project.home.apartmentFloor ?? 0}
              onApartmentFloor={(apartmentFloor) =>
                executeProjectAction({ type: "update-home-settings", changes: { apartmentFloor } })
              }
            />
          )}
          <EditorModeIntroduction mode={settingsMode ? "settings" : mode} />
          {!settingsMode && mode === "construct" && (
            <ConstructionToolCards
              inert={editingLocked || unsettled || reference.adjusting}
              tool={constructEditor.tool}
              stairsActive={Boolean(stairPlacement)}
              stairsDisabledReason={
                snapshot.project.floors.at(-1)?.id === activeFloorId
                  ? "Add a floor above first."
                  : undefined
              }
              onToolChange={(tool) => {
                setStairPlacement(null);
                constructEditor.setTool(tool);
                onMobileToolChoose();
              }}
              onStairs={() => {
                startStairs();
                onMobileToolChoose();
              }}
            />
          )}
          {settingsMode && settingsNavigation}
          {!settingsMode && tutorial.state?.status === "active" && (
            <BuildTutorial
              state={tutorial.state}
              mode={mode}
              disabled={tutorialBusy}
              warning={tutorial.warning}
              onAction={activateTutorial}
              onSkip={tutorial.skip}
              onDismiss={tutorial.dismiss}
            />
          )}
          {!settingsMode &&
            mode === "construct" &&
            tutorial.state?.status !== "active" &&
            isPristineConstructionFloor(constructEditor.previewFloor) && (
              <p className="construction-empty-hint">
                Your plan starts here. Choose Wall, then click each corner to draw your first room.
              </p>
            )}
          {!settingsMode && mode === "construct" && stairPlacement && (
            <StairPlacementPanel
              shape={stairPlacement.shape ?? "straight"}
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
              referencePlanControls={
                <ReferencePlanPanel
                  reference={reference}
                  floorName={constructEditor.previewFloor.name}
                />
              }
              planImportControls={
                PLAN_IMPORT_ENABLED && (
                  <PlanImportActions
                    homeId={snapshot.project.home.id}
                    disabled={tutorialBusy}
                    onImport={importWorkspace}
                  />
                )
              }
              tutorialControls={
                tutorial.state?.status !== "active" && (
                  <details className="construction-inspector__floor-disclosure">
                    <SidebarSectionSummary
                      icon="tutorial"
                      title="Tutorial"
                      description="Learn to draw and furnish your first room."
                    />
                    <div className="sidebar-section-content">
                      <EditorButton disabled={tutorialBusy} onClick={tutorial.restart}>
                        Restart tutorial
                      </EditorButton>
                    </div>
                  </details>
                )
              }
              walkStartControls={
                <details className="construction-inspector__floor-disclosure">
                  <SidebarSectionSummary
                    icon="spawn"
                    title="Spawn area"
                    description="Choose where you start in Explore."
                  />
                  <div
                    className="construction-walk-start sidebar-section-content"
                    role="group"
                    aria-label="Walk starting point"
                  >
                    <EditorButton
                      aria-pressed={placingWalkStart}
                      disabled={unsettled && !placingWalkStart}
                      onClick={() => {
                        clearConstructionSelection();
                        constructEditor.setTool("select");
                        setWalkStartFloor(placingWalkStart ? null : activeFloorId);
                      }}
                    >
                      {placingWalkStart
                        ? "Cancel"
                        : snapshot.project.home.walkStart
                          ? "Move starting point"
                          : "Set starting point"}
                    </EditorButton>
                    {placingWalkStart && (
                      <p role="status">
                        Click inside the floor to set your starting point. Escape cancels.
                      </p>
                    )}
                    {snapshot.project.home.walkStart && (
                      <EditorButton
                        variant="text"
                        onClick={() => {
                          executeProjectAction({ type: "set-walk-start", walkStart: null });
                          setWalkStartFloor(null);
                        }}
                      >
                        Use automatic start
                      </EditorButton>
                    )}
                  </div>
                </details>
              }
              northControls={
                <NorthSettingsEditor
                  value={snapshot.project.home.northAngleDegrees ?? 0}
                  disabled={editingLocked || unsettled || reference.adjusting}
                  onEdit={northOrientation.start}
                />
              }
              roof={snapshot.project.home.roof}
              terrainControls={
                <TerrainSettingsEditor
                  value={snapshot.project.home.terrain}
                  disabled={(snapshot.project.home.apartmentFloor ?? 0) > 0}
                  onChange={(terrain) =>
                    executeProjectAction({ type: "update-home-settings", changes: { terrain } })
                  }
                />
              }
              onRoofChange={(roof) =>
                executeProjectAction({ type: "update-home-settings", changes: { roof } })
              }
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
