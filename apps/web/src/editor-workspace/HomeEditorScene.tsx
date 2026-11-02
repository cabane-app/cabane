import { EditorConnectionMap } from "./EditorConnectionMap";
import { NorthOrientationOverlay } from "../editor-preview/construct/NorthOrientationOverlay";
import { editorCanvasEvents } from "./editor-canvas-events";
import { ConstructionPlatformLayer } from "../editor-preview/construct/ConstructionPlatformLayer";
import { useReferenceCanvas } from "../editor-reference-plan/ReferenceCanvasLayers";
import type { ReferencePlanController } from "../editor-reference-plan/useReferencePlan";
import { ConstructionGrid } from "../editor-preview/construct/ConstructionGrid";
import { WalkStartPointer } from "../editor-preview/construct/WalkStartPointer";
import { EditableStair } from "../editor-floors/EditableStair";
import { SelectedRoomControls } from "../editor-preview/construct/SelectedRoomControls";
import { ConstructionHedgeLayer } from "../editor-preview/construct/ConstructionHedgeLayer";
import { StairPlacement } from "../editor-floors/StairPlacement";
import { AdjacentFloorGuide } from "../editor-floors/AdjacentFloorGuide";
import { SelectedOpeningControls } from "../editor-preview/construct/SelectedOpeningControls";

import { Canvas } from "@react-three/fiber";

import { stableArchitectureModelRegistry } from "@cabane/catalog/architecture";

import {
  type ManifestIssue,
  deriveFloorLevels,
  stairFloorIds,
  StylizedScene,
  ArchitectureScene,
} from "@cabane/engine";

import { Suspense, useMemo } from "react";
import { RetainedArrangeScene } from "./RetainedArrangeScene";

import { FurnishingSelectionControls } from "../editor-preview/furnish/FurnishingSelectionControls";

import {
  ConstructionEditLayer,
  ConstructionFloorLayer,
  ConstructionMeasureOverlay,
  ConstructionPoolLayer,
  ConstructionValidationOverlay,
} from "../editor-preview/construct";

import { ArrangePlanOpenings, FurnishingEditLayer } from "../editor-preview/furnish";

import { ConstructionPlan } from "../editor-preview/construct/ConstructionPlan";

import { PreviewCamera } from "../editor-preview/PreviewCamera";
import type { useHomeEditorController } from "./useHomeEditorController";

const NO_INTERACTION = () => undefined;
type Props = {
  onStairIssuesChange?: (issues: readonly ManifestIssue[] | null) => void;
  reference: ReferencePlanController;
  onNameFocusHandled?: () => void;
  cameraFocusRoomId?: string | null;
  nameFocusRequest?: { roomId: string; serial: number } | null;
  placingWalkStart: boolean;
  onWalkStartPlaced: () => void;
} & Pick<
  ReturnType<typeof useHomeEditorController>,
  | "northOrientation"
  | "placementFloor"
  | "selectSceneItem"
  | "stairDialog"
  | "floorNavigation"
  | "activeFloorId"
  | "stairPlacement"
  | "setStairPlacement"
  | "setStairDialog"
  | "floorReferences"
  | "executeProjectAction"
  | "snapshot"
  | "connectFloor"
  | "mode"
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "connectManifest"
  | "connect"
  | "clearConstructionSelection"
  | "clearFurnishingSelection"
  | "cameraView"
  | "cameraResetKey"
  | "constructEditor"
  | "dragging"
  | "cameraFocusPoint"
  | "handleCameraTargetChange"
  | "savedCamera"
  | "previewSceneItems"
  | "displayedContextualIssues"
  | "activeIssueKey"
  | "issueFocusVersion"
  | "poolDrawing"
  | "floorZoneDrawing"
  | "focusIssue"
  | "furnishingModels"
  | "deviceModels"
  | "visualManifest"
  | "selectedRoomId"
  | "editorResolvedBindings"
  | "marqueeSelecting"
  | "floorPaintTarget"
  | "requestRoomPaint"
  | "setDragging"
  | "constructMeasure"
  | "setSelectedRoomId"
  | "setMarqueeSelecting"
  | "selectedOpening"
  | "duplicateConstructionOpening"
  | "visualSceneItems"
  | "furnishingEditor"
  | "selectedItem"
  | "selectedDefinition"
  | "unsettled"
  | "selectMode"
  | "duplicateArrangeItem"
  | "deleteSceneItem"
>;
export function HomeEditorScene({
  reference,
  northOrientation,
  onStairIssuesChange,
  onNameFocusHandled,
  cameraFocusRoomId,
  nameFocusRequest,
  placingWalkStart,
  onWalkStartPlaced,
  placementFloor,
  selectSceneItem,
  stairDialog,
  floorNavigation,
  activeFloorId,
  stairPlacement,
  setStairPlacement,
  setStairDialog,
  floorReferences,
  executeProjectAction,
  snapshot,
  connectFloor,
  mode,
  editingLocked,
  publishOpen,
  previewOpen,
  connect,
  clearConstructionSelection,
  clearFurnishingSelection,
  cameraView,
  cameraResetKey,
  constructEditor,
  dragging,
  cameraFocusPoint,
  handleCameraTargetChange,
  savedCamera,
  previewSceneItems,
  displayedContextualIssues,
  activeIssueKey,
  issueFocusVersion,
  poolDrawing,
  floorZoneDrawing,
  focusIssue,
  furnishingModels,
  deviceModels,
  visualManifest,
  selectedRoomId,
  editorResolvedBindings,
  marqueeSelecting,
  floorPaintTarget,
  requestRoomPaint,
  setDragging,
  constructMeasure,
  setSelectedRoomId,
  setMarqueeSelecting,
  selectedOpening,
  duplicateConstructionOpening,
  visualSceneItems,
  furnishingEditor,
  selectedItem,
  selectedDefinition,
  unsettled,
  selectMode,
  duplicateArrangeItem,
  deleteSceneItem,
}: Props) {
  const stairRegistries = useMemo(
    () => ({ furnishingModels, deviceModels }),
    [furnishingModels, deviceModels],
  );
  const referenceCanvas = useReferenceCanvas(
    reference,
    constructEditor.previewFloor,
    mode === "construct",
  );
  const levels = deriveFloorLevels(visualManifest.floors);
  const activeLevel = levels.find((level) => level.floorId === activeFloorId)?.elevationMeters ?? 0;
  return (
    <div
      {...referenceCanvas.handlers}
      tabIndex={-1}
      onDragOver={(event) => {
        if (mode === "construct" && event.dataTransfer.types.includes("Files"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        if (mode !== "construct") return;
        event.preventDefault();
        void reference.upload(event.dataTransfer.files);
      }}
      className={`direction-preview__model${mode === "connect" ? " connect-map" : ""}`}
      aria-label={
        mode === "connect"
          ? "Home connection map"
          : mode === "construct"
            ? "2D construction plan"
            : "3D home editor"
      }
      inert={editingLocked || publishOpen || previewOpen}
    >
      {mode === "connect" && <EditorConnectionMap connectFloor={connectFloor} connect={connect} />}
      {referenceCanvas.background}
      <div
        inert={northOrientation.active}
        hidden={mode === "connect"}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        <Canvas
          events={editorCanvasEvents}
          tabIndex={0}
          style={{ outline: "none" }}
          aria-label="Home editor canvas"
          onPointerDownCapture={(event) => {
            // Leave inspector inputs before a scene click, so subsequent
            // Delete/undo shortcuts belong to the editor instead of the field.
            if (event.target instanceof HTMLCanvasElement) {
              event.currentTarget.focus({ preventScroll: true });
            }
          }}
          onPointerMissed={(event) => {
            if (event.type !== "click" || event.button !== 0) return;
            if (mode === "construct") clearConstructionSelection();
            else if (mode === "furnish") clearFurnishingSelection();
          }}
          shadows={false}
          dpr={1}
          frameloop="demand"
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            {referenceCanvas.bridge}
            <StylizedScene active={mode === "furnish"}>
              {mode !== "construct" && (
                <>
                  <hemisphereLight args={["#ecf4ff", "#768b93", 0.95]} />
                  <directionalLight
                    position={[7, 12, 8]}
                    color="#fff0d7"
                    intensity={1.8}
                    castShadow={false}
                  />
                </>
              )}
              {mode === "construct" && (
                <WalkStartPointer
                  floor={constructEditor.previewFloor}
                  start={snapshot.project.home.walkStart}
                  placing={placingWalkStart}
                  onPlace={(at) => {
                    executeProjectAction({
                      type: "set-walk-start",
                      walkStart: { floorId: activeFloorId, at },
                    });
                    onWalkStartPlaced();
                  }}
                />
              )}
              {mode === "construct" && !referenceCanvas.visible && <ConstructionGrid />}
              <PreviewCamera
                northOrientation={northOrientation.active}
                planWheelNavigation={mode === "construct" || mode === "furnish"}
                view={mode === "construct" ? "top" : cameraView}
                resetKey={cameraResetKey}
                floor={constructEditor.previewFloor}
                controlsEnabled={!dragging && !placingWalkStart && !northOrientation.active}
                focusPoint={cameraFocusPoint}
                focusRoomId={cameraFocusRoomId}
                onTargetChange={handleCameraTargetChange}
                savedCamera={savedCamera}
              />
              <ConstructionValidationOverlay
                planMode={mode === "construct"}
                floor={constructEditor.previewFloor}
                sceneItems={previewSceneItems}
                issues={
                  mode === "construct"
                    ? displayedContextualIssues.filter(
                        (issue) =>
                          !issue.code.startsWith("stair.") &&
                          issue.code !== "room.name" &&
                          issue.code !== "topology.room-name",
                      )
                    : displayedContextualIssues
                }
                activeIssueKey={activeIssueKey}
                focusVersion={issueFocusVersion}
                showLabels={
                  mode !== "construct" ||
                  (!dragging &&
                    !constructEditor.drawStart &&
                    !poolDrawing.active &&
                    !floorZoneDrawing.active)
                }
                onActivate={focusIssue}
              />
              {mode === "construct" &&
                !stairPlacement &&
                !(dragging && stairDialog) &&
                floorReferences.references.map(
                  ({ direction, floor, visible }) =>
                    visible && (
                      <AdjacentFloorGuide key={direction} floor={floor} direction={direction} />
                    ),
                )}
              {mode === "construct" &&
                snapshot.project.stairs.map((stair) => {
                  if (!stairFloorIds(stair).includes(activeFloorId)) return null;
                  const selected =
                    stairDialog?.id === stair.id &&
                    constructEditor.tool === "select" &&
                    !stairPlacement;
                  const destination = stair.terrain
                    ? stair.terrain.floorId
                    : stair.lowerFloorId === activeFloorId
                      ? stair.upperFloorId
                      : stair.lowerFloorId;
                  return (
                    <EditableStair
                      key={`${activeFloorId}:${stair.id}`}
                      registries={stairRegistries}
                      onIssuesChange={selected ? onStairIssuesChange : undefined}
                      building={snapshot.project}
                      stair={stair}
                      activeFloorId={activeFloorId}
                      selected={selected}
                      enabled={
                        constructEditor.tool === "select" && !stairPlacement && !editingLocked
                      }
                      onSelect={() => {
                        clearConstructionSelection();
                        setStairDialog(stair);
                      }}
                      onDraggingChange={setDragging}
                      onCommit={(stair) => executeProjectAction({ type: "update-stair", stair })}
                      onGoToFloor={() => floorNavigation.selectFloor(destination)}
                      onDelete={() => {
                        executeProjectAction({ type: "delete-stair", stairId: stair.id });
                        setStairDialog(null);
                      }}
                    />
                  );
                })}
              {mode === "construct" ? (
                <ConstructionPlan
                  showFinishes={!referenceCanvas.visible}
                  nameFocusRequest={nameFocusRequest}
                  onNameFocusHandled={onNameFocusHandled}
                  namingDisabled={
                    reference.adjusting ||
                    editingLocked ||
                    publishOpen ||
                    previewOpen ||
                    unsettled ||
                    Boolean(constructEditor.drawStart) ||
                    placingWalkStart ||
                    marqueeSelecting
                  }
                  onRoomNameChange={(id, name) => constructEditor.updateRoom(id, { name })}
                  floor={constructEditor.previewFloor}
                  items={previewSceneItems}
                  furnishingModels={furnishingModels}
                  deviceModels={deviceModels}
                />
              ) : null}
              <RetainedArrangeScene active={mode === "furnish"}>
                <ArchitectureScene
                  manifest={visualManifest}
                  activeFloorId={activeFloorId}
                  floorView={cameraView === "top" ? "plan" : "cutaway"}

                  interactionMode="editor"
                  architectureModels={stableArchitectureModelRegistry}
                  selectedRoomId={selectedRoomId}
                  walkMode={false}
                  wallFadeEnabled={cameraView === "3d"}
                  reducedMotion
                  resolvedBindings={editorResolvedBindings}
                  deviceModels={deviceModels}
                  openingPositions={{}}
                  onInteract={NO_INTERACTION}
                />
              </RetainedArrangeScene>
              {mode === "construct" && (
                <ConstructionFloorLayer
                  draft={constructEditor.draft}
                  floor={constructEditor.previewFloor}
                  selection={marqueeSelecting ? null : constructEditor.selection}
                  deletionTargets={marqueeSelecting ? [] : constructEditor.deletionTargets}
                  tool={constructEditor.tool}
                  paintTarget={floorPaintTarget}
                  drawingPoints={floorZoneDrawing.points}
                  drawingPreview={floorZoneDrawing.preview}
                  drawingRoomId={floorZoneDrawing.roomId}
                  onPaintRoom={requestRoomPaint}
                  onSelectZone={constructEditor.selectFloorZone}
                  onUpdateZone={(zoneId, polygon) =>
                    constructEditor.updateFloorZone(zoneId, { polygon })
                  }
                  onDraggingChange={setDragging}
                />
              )}
              {mode === "construct" && (
                <ConstructionEditLayer
                  doorConfiguration={constructEditor.doorConfiguration}
                  referenceWalls={floorReferences.referenceWalls}
                  planMode
                  draft={constructEditor.draft}
                  coordinates={constructEditor.previewFloor.coordinates}
                  rooms={constructEditor.previewFloor.rooms}
                  selection={constructEditor.selection}
                  deletionTargets={constructEditor.deletionTargets}
                  previewFloor={constructEditor.previewFloor}
                  wallRuns={constructEditor.wallRuns}
                  tool={constructEditor.tool}
                  drawStart={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? (poolDrawing.points.at(-1) ?? null)
                      : constructEditor.drawStart
                  }
                  drawPreview={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? poolDrawing.preview
                      : constructEditor.drawPreview
                  }
                  drawAngleReferenceRadians={
                    constructEditor.tool === "wall" || constructEditor.tool === "virtual-wall"
                      ? constructEditor.drawAngleReferenceRadians
                      : null
                  }
                  wallExteriorColor={constructEditor.exteriorWallColor}
                  poolPoints={poolDrawing.points}
                  floorPaintTarget={floorPaintTarget}
                  floorZonePoints={floorZoneDrawing.points}
                  floorZonePreview={floorZoneDrawing.preview}
                  onCancelFloorZone={floorZoneDrawing.cancel}
                  measurePhase={constructMeasure.phase}
                  onSelectWall={(wallId) => {
                    setSelectedRoomId(null);
                    constructEditor.selectWall(wallId);
                  }}
                  onSelectOpening={(openingId) => {
                    setSelectedRoomId(null);
                    constructEditor.selectOpening(openingId);
                  }}
                  onSelectRoom={constructEditor.selectRoom}
                  onSelectMany={constructEditor.selectMany}
                  onClearSelection={clearConstructionSelection}
                  onMoveEndpoint={constructEditor.updateWallEndpoint}
                  onTranslateWall={constructEditor.translateWall}
                  onMoveOpening={constructEditor.moveOpening}
                  onResizeOpening={constructEditor.resizeSelectedOpening}
                  onPlaceOpening={constructEditor.placeOpening}
                  onBeginWall={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? poolDrawing.place
                      : constructEditor.beginWall
                  }
                  onPreviewWall={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? poolDrawing.previewPoint
                      : constructEditor.previewWall
                  }
                  onAddWall={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? poolDrawing.place
                      : constructEditor.addWall
                  }
                  onCancelWall={
                    constructEditor.tool === "pool" || constructEditor.tool === "platform"
                      ? poolDrawing.cancel
                      : constructEditor.cancelWall
                  }
                  onPlaceMeasure={constructMeasure.place}
                  onPreviewMeasure={constructMeasure.preview}
                  onPlaceFloorZonePoint={floorZoneDrawing.place}
                  onPreviewFloorZonePoint={floorZoneDrawing.previewPoint}
                  onDraggingChange={setDragging}
                  onMarqueeChange={setMarqueeSelecting}
                />
              )}
              {mode === "construct" && !editingLocked && (
                <ConstructionHedgeLayer editor={constructEditor} onDraggingChange={setDragging} />
              )}
              {mode === "construct" && (
                <ConstructionPlatformLayer
                  draft={constructEditor.draft}
                  selection={marqueeSelecting ? null : constructEditor.selection}
                  tool={constructEditor.tool}
                  points={poolDrawing.points}
                  preview={poolDrawing.preview}
                  deletionTargets={constructEditor.deletionTargets}
                  selectedEdgeId={constructEditor.selectedPlatformEdgeId}
                  onSelect={constructEditor.selectPlatform}
                  onSelectEdge={constructEditor.selectPlatformEdge}
                  onUpdate={(id, polygon) => constructEditor.updatePlatform(id, { polygon })}
                  onDraggingChange={setDragging}
                />
              )}
              {mode === "construct" && (
                <ConstructionPoolLayer
                  draft={constructEditor.draft}
                  selection={marqueeSelecting ? null : constructEditor.selection}
                  tool={constructEditor.tool}
                  points={poolDrawing.points}
                  preview={poolDrawing.preview}
                  deletionTargets={marqueeSelecting ? [] : constructEditor.deletionTargets}
                  onSelect={constructEditor.selectPool}
                  onUpdate={constructEditor.updatePool}
                  onDraggingChange={setDragging}
                />
              )}
              {mode === "construct" && !marqueeSelecting && (
                <SelectedRoomControls
                  editor={constructEditor}
                  disabled={dragging || editingLocked}
                />
              )}
              {mode === "construct" && !marqueeSelecting && selectedOpening && (
                <SelectedOpeningControls
                  key={selectedOpening.id}
                  opening={selectedOpening}
                  draft={constructEditor.draft}
                  disabled={dragging || editingLocked}
                  canDuplicate={constructEditor.canDuplicateOpening(selectedOpening.id)}
                  onChange={(change) =>
                    constructEditor.dispatch({
                      type: "reorient-opening",
                      openingId: selectedOpening.id,
                      change,
                    })
                  }
                  onDuplicate={() => duplicateConstructionOpening(selectedOpening.id)}
                  onDelete={constructEditor.deleteSelected}
                />
              )}
              {mode === "construct" && constructEditor.tool === "measure" && (
                <ConstructionMeasureOverlay
                  planMode
                  measurement={constructMeasure.measurement}
                  preview={constructMeasure.phase === "drawing"}
                  onCopy={(value) => void navigator.clipboard?.writeText(value)}
                />
              )}
              {mode === "furnish" && cameraView === "top" && (
                <ArrangePlanOpenings floor={constructEditor.previewFloor} />
              )}
              {mode === "furnish" &&
                cameraView === "3d" &&
                visualManifest.floors
                  .slice(
                    0,
                    visualManifest.floors.findIndex((floor) => floor.id === activeFloorId),
                  )
                  .map((floor) => (
                    <group
                      key={floor.id}
                      position={[
                        0,
                        (levels.find((level) => level.floorId === floor.id)?.elevationMeters ?? 0) -
                          activeLevel,
                        0,
                      ]}
                    >
                      <FurnishingEditLayer
                        items={visualManifest.sceneItems.filter(
                          (item) => item.floorId === floor.id,
                        )}
                        floor={floor}
                        furnishingModels={furnishingModels}
                        deviceModels={deviceModels}
                        selectedId={null}
                        selectionOnly
                        onSelect={selectSceneItem}
                        onMovePlacement={NO_INTERACTION}
                      />
                    </group>
                  ))}
              {mode === "furnish" && (
                <FurnishingEditLayer
                  items={visualSceneItems}
                  floor={placementFloor}
                  furnishingModels={furnishingModels}
                  deviceModels={deviceModels}
                  selectedId={furnishingEditor.selectedId}
                  selectedIds={furnishingEditor.selectedIds}
                  onSelectMany={furnishingEditor.selectMany}
                  onSelect={furnishingEditor.select}
                  onMovePlacements={furnishingEditor.updatePlacements}
                  onMovePlacement={furnishingEditor.updatePlacement}
                  onDragStart={furnishingEditor.beginTransaction}
                  onDragEnd={furnishingEditor.commitTransaction}
                  onDragCancel={furnishingEditor.cancelTransaction}
                  onDraggingChange={setDragging}
                />
              )}
              {mode === "furnish" && (
                <FurnishingSelectionControls
                  editor={furnishingEditor}
                  items={visualSceneItems}
                  selectedItem={selectedItem}
                  selectedDefinition={selectedDefinition}
                  furnishingModels={furnishingModels}
                  deviceModels={deviceModels}
                  floor={placementFloor}
                  busy={dragging || Boolean(furnishingEditor.transaction)}
                  setDragging={setDragging}
                  onConnect={
                    selectedItem &&
                    ((selectedItem.entitySlots?.length ?? 0) > 0 || !!selectedItem.lightSlotId) &&
                    !unsettled
                      ? () => {
                          if (
                            connect.selectDevice(
                              selectedItem.kind === "device"
                                ? selectedItem.id
                                : (selectedItem.lightSlotId ??
                                    selectedItem.entitySlots?.[0]?.id ??
                                    selectedItem.id),
                            )
                          )
                            selectMode("connect", true);
                        }
                      : undefined
                  }
                  onDuplicate={duplicateArrangeItem}
                  onDelete={deleteSceneItem}
                />
              )}
            </StylizedScene>
            {mode === "construct" && stairPlacement && (
              <StairPlacement
                key={`${activeFloorId}:${stairPlacement.id}:${stairPlacement.shape ?? "straight"}`}
                registries={stairRegistries}
                onIssuesChange={onStairIssuesChange}
                building={snapshot.project}
                stair={stairPlacement}
                coordinates={snapshot.project.coordinates}
                onDraggingChange={setDragging}
                onCancel={() => setStairPlacement(null)}
                onComplete={(stair) => {
                  executeProjectAction({ type: "add-stair", stair });
                  setStairPlacement(null);
                  setStairDialog(stair);
                }}
              />
            )}
          </Suspense>
        </Canvas>
      </div>
      {northOrientation.active && (
        <NorthOrientationOverlay
          angle={northOrientation.angle}
          onRotate={northOrientation.rotate}
          onCancel={northOrientation.cancel}
          onConfirm={northOrientation.confirm}
        />
      )}
      {referenceCanvas.controls}
      {referenceCanvas.assetError && mode === "construct" && (
        <p className="reference-asset-error" role="alert">
          {referenceCanvas.assetError}
        </p>
      )}
    </div>
  );
}
