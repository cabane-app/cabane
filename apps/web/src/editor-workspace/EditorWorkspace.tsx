import { MeasurementText } from "@cabane/engine";
import { EditorSettings } from "../editor-settings/EditorSettings";
import { SettingsNavigation } from "../editor-settings/SettingsNavigation";
import type { SettingsSection } from "../editor-settings/settings-sections";
import { EditorDraftStatus } from "./EditorDraftStatus";
import { roomsForFloor } from "@cabane/engine";
import { WallFinishPreviewProvider } from "../editor-preview/construct/WallFinishPreview";
import type { BuildTutorialStep, ManifestIssue } from "@cabane/engine";
import {
  FloorPicker,
  floorRemovalDisabledReason,
  normalizeWorkspaceBindingOrigin,
  resolveHomeAssistantBindings,
  resolveHomeAssistantPictureUrl,
  useCabaneAssetUrl,
  useCabaneDom,
} from "@cabane/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorFloorDialog } from "./EditorFloorDialog";
import { useBuildTutorial } from "../editor-onboarding/useBuildTutorial";
import { installedWalkTools } from "../walk-tools";
import { EditorCompletionDialogs } from "./EditorCompletionDialogs";
import { EditorSelectionDetails } from "./EditorSelectionDetails";
import { ConnectInspector } from "../editor-connect/ConnectInspector";
import { EditorSidebar } from "./EditorSidebar";
import { EditorValidationPanel } from "./EditorValidationPanel";
import { EditorPanels } from "./EditorPanels";
import { useMobileEditorViewport } from "./useMobileEditorViewport";
import { EditorPanelControls } from "./EditorPanelControls";
import { editorPanelSelection, useEditorPanels } from "./useEditorPanels";

import { ownerProjectRegistries } from "../project-runtime";

import { stageImportedWorkspace } from "../editor-connect/profile-transfer";

import { ActionBarEditor } from "../editor-action-bar/ActionBarEditor";
import { ShortcutThumbnailSurface } from "../editor-action-bar/ShortcutDeviceIcon";
import type { EditorMode } from "../editor-chrome/EditorModeNav";
import { HomeEditorHeader } from "./HomeEditorHeader";
import { HomeEditorScene } from "./HomeEditorScene";
import { useHomeEditorController } from "./useHomeEditorController";
import { AgentPilotPanel } from "../agent-pilot/AgentPilotPanel";
import { DevAgentBridge } from "../agent-pilot/DevAgentBridge";

export function EditorWorkspace(props: Parameters<typeof useHomeEditorController>[0]) {
  const controller = useHomeEditorController(props);
  const { repairIssue, repairMessage, repairError, itemLabel } = controller.repairs;
  const placementError = controller.furnishingEditor.placementError ?? repairError;
  const {
    editorProject,
    northOrientation,
    setActionBarItems,
    focusRoom,
    floorNavigation,
    activeFloorId,
    stairPlacement,
    stairDialog,
    setFloorDialog,
    floorReferences,
    mode,
    editingLocked,
    publishOpen,
    previewOpen,
    connect,
    constructEditor,
    displayedContextualIssues,
    deviceModels,
    unsettled,
    selectMode,
    runtime,
    reference,
    workspace,
    undoProject,
    redoProject,
    homeAssistantUrl,
    snapshot,
    commit,
    replaceEditorsFromProject,
    editedManifest,
  } = controller;
  const [stairLiveIssues, setStairLiveIssues] = useState<readonly ManifestIssue[] | null>(null);
  const [agentPilotOpen, setAgentPilotOpen] = useState(() => Boolean(props.agentPilotOpen));
  useEffect(() => {
    setStairLiveIssues(null);
  }, [mode, activeFloorId, stairDialog?.id, stairPlacement?.shape]);
  useEffect(() => {
    setAgentPilotOpen(Boolean(props.agentPilotOpen));
  }, [props.agentPilotOpen]);
  const onAgentPilotClose = props.onAgentPilotClose;
  const closeAgentPilot = useCallback(() => {
    setAgentPilotOpen(false);
    onAgentPilotClose?.();
  }, [onAgentPilotClose]);
  const tutorial = useBuildTutorial(
    editorProject,
    mode,
    Object.keys(workspace.snapshot.references ?? {}).length > 0,
  );
  const request = props.navigation?.request ?? props.initialRequest;
  const requestedSettings =
    request?.panel === "settings" ||
    request?.panel === "action-bar" ||
    request?.panel === "home-assistant";
  const requestedSection =
    request?.settingsSection ?? (request?.panel === "action-bar" ? "shortcuts" : "home-assistant");
  const [localSettings, setLocalSettings] = useState<SettingsSection | null>(
    requestedSettings ? requestedSection : null,
  );
  const [settingsBusy, setSettingsBusy] = useState(false);
  const settingsMode = props.navigation ? requestedSettings : localSettings !== null;
  const settingsSection = props.navigation ? requestedSection : (localSettings ?? "home-assistant");
  const dom = useCabaneDom();
  const iconUrl = useCabaneAssetUrl("cabane-icon.png");
  const selectSettingsSection = (section: SettingsSection) => {
    if (settingsBusy || editingLocked || unsettled) return;
    setLocalSettings(section);
    props.navigation?.go({ mode, panel: "settings", settingsSection: section });
  };
  const mobileViewport = useMobileEditorViewport();
  const mobileEditor =
    mobileViewport && !settingsMode && (mode === "construct" || mode === "furnish");
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const content = sidebar.current?.querySelector<HTMLElement>(".editor-sidebar-content");
    if (content) content.scrollTop = 0;
  }, [mode, settingsMode, settingsSection]);
  const onModeTabChange = (next: EditorMode | "settings") => {
    if (settingsBusy || editingLocked) return;
    reference.cancel();
    if (next === "settings") {
      selectSettingsSection(settingsSection);
    } else {
      setLocalSettings(null);
      selectMode(next);
    }
  };
  const panelBusy = unsettled || controller.marqueeSelecting || Boolean(constructEditor.drawStart);
  const panels = useEditorPanels(
    editorPanelSelection(controller, settingsMode),
    panelBusy,
    displayedContextualIssues.length > 0,
    `${mode}:${activeFloorId}:${settingsMode}`,
  );
  const panelIssues = displayedContextualIssues;
  const { closeMobilePanel } = panels;
  const panelsDisabled =
    editingLocked || publishOpen || previewOpen || northOrientation.active || panelBusy;
  const issuesExpanded = panels.issuesOpen;
  const collapseProperties = () => {
    panels.collapseProperties();
    requestAnimationFrame(() =>
      dom.root
        .querySelector<HTMLButtonElement>(
          ".editor-properties-toggle, .editor-panel-switcher button",
        )
        ?.focus(),
    );
  };
  const bindingOrigin = homeAssistantUrl ? normalizeWorkspaceBindingOrigin(homeAssistantUrl) : null;
  const roomAreaIds = bindingOrigin
    ? snapshot.bindings[bindingOrigin]?.draft.roomAreaIds
    : undefined;
  const roomPictures = Object.fromEntries(
    editorProject.floors.flatMap((floor) =>
      roomsForFloor(floor).map((room) => {
        const area = runtime.areas.find((area) => area.area_id === roomAreaIds?.[room.id]);
        return [room.id, resolveHomeAssistantPictureUrl(area?.picture, runtime.origin)] as const;
      }),
    ),
  );
  const roomNames = Object.fromEntries(
    editorProject.floors.flatMap((floor) =>
      roomsForFloor(floor).map((room) => {
        const area = runtime.areas.find((area) => area.area_id === roomAreaIds?.[room.id]);
        return [room.id, area?.name?.trim() || room.name] as const;
      }),
    ),
  );
  const shortcutBindings = useMemo(
    () => resolveHomeAssistantBindings(editedManifest, connect.profile, runtime, deviceModels),
    [editedManifest, connect.profile, runtime, deviceModels],
  );
  const deviceNames = Object.fromEntries(
    Object.values(shortcutBindings.rooms).flatMap((room) =>
      room.devices.flatMap((device) =>
        device.displayName ? [[device.slot.id, device.displayName]] : [],
      ),
    ),
  );
  const [nameFocusRequest, setNameFocusRequest] = useState<{
    roomId: string;
    serial: number;
  } | null>(null);
  const [tutorialAction, setTutorialAction] = useState<{
    step: BuildTutorialStep;
    target?: { floorId: string; roomId: string };
  } | null>(null);
  const tutorialBusy =
    (tutorial.state?.step === "reference" && !reference.storage.ready) ||
    editingLocked ||
    unsettled ||
    Boolean(constructEditor.drawStart) ||
    publishOpen ||
    previewOpen;
  const importWorkspace = (json: string) => {
    const next = stageImportedWorkspace(
      { ...workspace.getRecord(), draft: snapshot.project, bindings: snapshot.bindings },
      json,
      ownerProjectRegistries,
    );
    commit(next);
    replaceEditorsFromProject(next.project);
  };
  const activateTutorial = () => {
    const state = tutorial.state;
    if (!state || tutorialBusy) return;
    if (state.step === "reference") {
      reference.openPicker();
      return;
    }
    if (state.step === "arrange" && mode === "furnish") {
      tutorial.ready();
      return;
    }
    const nextMode =
      state.step === "arrange" ? "furnish" : state.step === "connect" ? "connect" : "construct";
    if (state.target) floorNavigation.selectFloor(state.target.floorId);
    selectMode(nextMode);
    setTutorialAction({
      step: state.step,
      ...(state.target === undefined ? {} : { target: state.target }),
    });
  };
  useEffect(() => {
    if (!tutorialAction || tutorialBusy) return;
    const { step, target } = tutorialAction;
    const desiredMode =
      step === "arrange" ? "furnish" : step === "connect" ? "connect" : "construct";
    if (
      mode !== desiredMode ||
      (target &&
        (activeFloorId !== target.floorId || constructEditor.previewFloor.id !== target.floorId))
    )
      return;
    if (target) focusRoom(target.roomId);
    if (step === "walls") constructEditor.setTool("wall");
    if (step === "door" || step === "window") constructEditor.setTool(step);
    if (step === "name" && target) {
      constructEditor.setTool("select");
      constructEditor.selectRoom(target.roomId);
      setNameFocusRequest({ roomId: target.roomId, serial: Date.now() });
    }
    setTutorialAction(null);
  }, [
    tutorialAction,
    tutorialBusy,
    mode,
    activeFloorId,
    constructEditor.previewFloor.id,
    constructEditor,
    focusRoom,
  ]);
  const [walkStartFloor, setWalkStartFloor] = useState<string | null>(null);
  useEffect(() => {
    setWalkStartFloor(null);
  }, [mode, activeFloorId, reference.adjusting]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalkStartFloor(null);
    };
    dom.events.addEventListener("keydown", cancel);
    return () => dom.events.removeEventListener("keydown", cancel);
  }, [dom]);
  useEffect(() => {
    if (constructEditor.tool !== "select" || stairPlacement) setWalkStartFloor(null);
  }, [constructEditor.tool, stairPlacement]);
  const placingWalkStart = mode === "construct" && walkStartFloor === activeFloorId;
  const canvasTask =
    reference.adjusting ||
    northOrientation.active ||
    placingWalkStart ||
    controller.floorZoneDrawing.active ||
    controller.poolDrawing.active;
  useEffect(() => {
    if (canvasTask) closeMobilePanel();
  }, [canvasTask, closeMobilePanel]);

  const floorControlsDisabled =
    editingLocked ||
    northOrientation.active ||
    (unsettled && !reference.adjusting) ||
    Boolean(controller.floorDialog);
  const removeDisabledReason = floorRemovalDisabledReason(snapshot.project.floors, activeFloorId);
  return (
    <WallFinishPreviewProvider palette={editorProject.home.palette}>
      {import.meta.env.DEV && import.meta.env.VITE_CABANE_DEV_AGENT === "1" && (
        <DevAgentBridge controller={controller} />
      )}
      <main
        className={`direction-preview${northOrientation.active ? " is-orienting-north" : ""}${settingsMode ? " is-settings" : mode === "connect" ? " is-connect" : mode === "construct" ? " is-plan" : ""}`}
        data-connect-room={mode === "connect" && Boolean(connect.room)}
        data-editor-mode={settingsMode ? "settings" : mode}
        data-properties-open={panels.propertiesOpen}
        data-has-issues={panelIssues.length > 0}
        data-issues-expanded={issuesExpanded}
        data-mobile-editor={mobileEditor}
        data-mobile-panel={
          mobileEditor && !panels.mobileOpen
            ? "closed"
            : panels.mobileSurface === "issues" && !panelIssues.length
              ? "tools"
              : panels.mobileSurface
        }
      >
        {!settingsMode && (
          <HomeEditorScene
            onStairIssuesChange={setStairLiveIssues}
            onNameFocusHandled={() => setNameFocusRequest(null)}
            nameFocusRequest={nameFocusRequest}
            placingWalkStart={placingWalkStart}
            onWalkStartPlaced={() => setWalkStartFloor(null)}
            {...controller}
          />
        )}

        {!settingsMode && mode === "connect" && connect.room && homeAssistantUrl && (
          <div
            className="connect-workspace-host"
            inert={editingLocked || publishOpen || previewOpen}
          >
            <ConnectInspector
              editor={connect}
              manifest={controller.connectManifest}
              deviceModels={deviceModels}
            />
          </div>
        )}
        <div
          className="editor-floor-controls"
          inert={publishOpen || previewOpen || northOrientation.active}
        >
          <FloorPicker
            floors={snapshot.project.floors}
            selectedId={activeFloorId}
            disabled={floorControlsDisabled}
            onSelect={(id) => floorNavigation.selectFloor(id)}
            onAdd={mode === "construct" ? () => setFloorDialog("add-above") : undefined}
            onAddBelow={mode === "construct" ? () => setFloorDialog("add-below") : undefined}
            onRename={mode === "construct" ? () => setFloorDialog("rename") : undefined}
            onRemove={
              mode === "construct" && !removeDisabledReason
                ? () => setFloorDialog("remove")
                : undefined
            }
          />
          {mode === "construct" &&
            floorReferences.references.map(({ direction, floor, visible }) => (
              <label key={direction} title={floor.name}>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) => floorReferences.setVisible(direction, event.target.checked)}
                />
                Show floor {direction}
              </label>
            ))}
        </div>
        <EditorFloorDialog controller={controller} removeDisabledReason={removeDisabledReason} />
        <HomeEditorHeader
          referenceAdjusting={reference.adjusting}
          {...controller}
          editingLocked={editingLocked || northOrientation.active || settingsBusy}
          settingsMode={settingsMode}
          onModeTabChange={onModeTabChange}
        />
        {settingsMode && (
          <EditorSettings
            section={settingsSection}
            controller={controller}
            importWorkspace={importWorkspace}
            onPrepareOrigin={props.onPrepareOrigin}
            isDemo={props.isDemo ?? false}
            onCreatePersonal={props.onCreatePersonal ?? (() => undefined)}
            onBusyChange={setSettingsBusy}
            shortcuts={
              <ShortcutThumbnailSurface>
                <ActionBarEditor
                  walkTools={installedWalkTools}
                  project={editorProject}
                  runtime={runtime}
                  profile={connect.profile}
                  actionMappingEnabled={!!bindingOrigin && runtime.origin === bindingOrigin}
                  deviceModels={deviceModels}
                  roomPictures={roomPictures}
                  roomNames={roomNames}
                  deviceNames={deviceNames}
                  disabled={editingLocked || unsettled || publishOpen || previewOpen}
                  canUndo={workspace.canUndo && !unsettled}
                  canRedo={workspace.canRedo && !unsettled}
                  onUndo={undoProject}
                  onRedo={redoProject}
                  onChange={setActionBarItems}
                />
              </ShortcutThumbnailSurface>
            }
          />
        )}

        <AgentPilotPanel
          workspaceId={props.initialRecord.homeId}
          controller={controller}
          open={agentPilotOpen}
          onClose={closeAgentPilot}
        />
        <EditorPanels
          mobile={mobileEditor}
          mode={settingsMode ? "settings" : mode}
          floorName={constructEditor.previewFloor.name}
          panels={panels}
          issueCount={panelIssues.length}
          disabled={panelsDisabled}
        >
          <EditorSidebar
            {...controller}
            onMobileToolChoose={panels.closeMobilePanel}
            addCatalogItem={(entry) => {
              const result = controller.addCatalogItem(entry);
              if (result.itemId) panels.closeMobilePanel();
              return result;
            }}
            onSelectPlacedItem={(id) => {
              controller.furnishingEditor.select(id);
              panels.openProperties();
            }}
            sidebar={sidebar}
            iconUrl={iconUrl}
            settingsMode={settingsMode}
            settingsNavigation={
              <SettingsNavigation
                section={settingsSection}
                onSelect={selectSettingsSection}
                disabled={settingsBusy || editingLocked || unsettled}
              />
            }
            floorControlsDisabled={floorControlsDisabled}
            addFloorAbove={() => setFloorDialog("add-above")}
            addFloorBelow={() => setFloorDialog("add-below")}
            tutorial={tutorial}
            tutorialBusy={tutorialBusy}
            activateTutorial={activateTutorial}
            stairLiveIssues={stairLiveIssues}
            importWorkspace={importWorkspace}
            placingWalkStart={placingWalkStart}
            setWalkStartFloor={setWalkStartFloor}
            onHomeAssistantSettings={() => selectSettingsSection("home-assistant")}
          />
          <EditorSelectionDetails
            {...controller}
            open={panels.propertiesOpen && !settingsMode}
            onCollapse={collapseProperties}
            liveStairIssues={stairLiveIssues}
            disabled={panelsDisabled}
          />
          <div
            className="editor-validation-host"
            inert={editingLocked || publishOpen || previewOpen || northOrientation.active}
          >
            <EditorValidationPanel
              issues={panelIssues}
              expanded={panels.issuesExpanded}
              onToggle={panels.toggleIssues}
              disabled={panelBusy}
              onRepair={repairIssue}
              itemLabel={itemLabel}
              onSelect={(issue) => {
                setLocalSettings(null);
                if (mobileEditor) panels.closeMobilePanel();
                else panels.openProperties();
                controller.focusIssue(issue);
              }}
            />
          </div>
        </EditorPanels>
        <div inert={editingLocked || publishOpen || previewOpen || northOrientation.active}>
          <EditorPanelControls
            mode={settingsMode ? "settings" : mode}
            panels={panels}
            issueCount={panelIssues.length}
            disabled={panelsDisabled}
          />
        </div>
        {placementError && (
          <div className="direction-status is-error" role="status">
            <span />
            <MeasurementText>{placementError}</MeasurementText>
          </div>
        )}
        <EditorDraftStatus workspace={workspace} homeAssistantUrl={homeAssistantUrl} />
        <div className="arrange-announcement" role="status">
          {repairMessage && <MeasurementText>{repairMessage}</MeasurementText>}
        </div>

        <EditorCompletionDialogs {...controller} />
      </main>
    </WallFinishPreviewProvider>
  );
}
