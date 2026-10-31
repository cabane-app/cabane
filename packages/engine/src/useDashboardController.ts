import { useHaActionShortcuts } from "./action-bar/useHaActionShortcuts";
import { resolvedRoomDisplayNames } from "./home-assistant-mapping/room-display-name";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useCabaneDom } from "./CabaneDom";
import { deriveFloorLevels, useFloorNavigation } from "./building";
import { resolveOpeningPositions, type RetainedOpeningPositions } from "./opening-pose";
import { useAdaptiveSceneQuality } from "./useAdaptiveSceneQuality";
import { useDashboardDeviceInteraction } from "./useDashboardDeviceInteraction";
import { useDashboardWalk } from "./useDashboardWalk";
import { useSceneCameraRequirements } from "./useSceneCameraRequirements";

import { useHomeAssistantRuntime } from "./HomeAssistantRuntime";

import { allLightsOffCall } from "./home-assistant-controls";

import { resolveHomeAssistantBindings } from "./home-assistant-resolver";

import { deriveHomePresence } from "./home-presence/model";

import { loadLightingMode, saveLightingMode } from "./walk-preferences";
import { resolveSolarLighting, type SolarLightingMode } from "./lighting";

import { readSceneSession, writeSceneSession } from "./navigation";

import { deriveRoomStatusMap } from "./room-status/model";

import { useCoarsePointer, useDocumentVisible, useReducedMotion } from "./SceneControls";

import type { BuiltInShortcutId, ExtensionInteractionTarget, SceneMode } from "./types";

import { orbitalEditorActionFromKey } from "./SceneActionBar";
import type { ActionBarItem } from "./action-bar/action-bar-config";
import {
  openActionBarDestination,
  resolveActionBarDestination,
} from "./action-bar/action-bar-navigation";

import { ValidatedDashboardProps } from "./validated-dashboard-contract";

export function useDashboardController({
  manifest,
  architectureModels,
  deviceModels,
  bindingManager,
  fallbackDemo,
  sessionPresentation,
  setupAction,
  setupOpen,
  mappingRequest,
  focusRoomId,
  onEditHome,
  onExportBrowserData,
  onOpenConnect,
  walkthrough,
  walkTools = [],
}: ValidatedDashboardProps) {
  const dom = useCabaneDom();
  const [equippedToolId, setEquippedToolId] = useState<string | null>(null);
  const floorNavigation = useFloorNavigation(manifest.floors);
  const { activeFloorId: floorNavigationActiveFloorId, selectFloor: floorNavigationSelectFloor } =
    floorNavigation;
  const floor =
    manifest.floors.find((floor) => floor.id === floorNavigationActiveFloorId) ??
    manifest.floors[0];
  const floorLevels = deriveFloorLevels(manifest.floors);
  const elevation = floorLevels.find((level) => level.floorId === floor.id)?.elevationMeters ?? 0;
  const runtime = useHomeAssistantRuntime();
  const demoSession =
    sessionPresentation?.mode === "demo" || (fallbackDemo && runtime.status === "unconfigured");
  const resolvedBindings = useMemo(
    () => resolveHomeAssistantBindings(manifest, bindingManager.profile, runtime, deviceModels),
    [manifest, bindingManager.profile, runtime, deviceModels],
  );
  const doorOpeningIds = useMemo(
    () =>
      new Set(
        manifest.floors.flatMap((floor) =>
          floor.openings.filter((opening) => opening.kind === "door").map((opening) => opening.id),
        ),
      ),
    [manifest.floors],
  );
  const roomStatuses = useMemo(
    () => deriveRoomStatusMap(manifest, bindingManager.profile, resolvedBindings, runtime),
    [bindingManager.profile, manifest, resolvedBindings, runtime],
  );
  const homePresence = useMemo(() => deriveHomePresence(runtime), [runtime]);
  const roomDisplayNames = useMemo(
    () => resolvedRoomDisplayNames(floor.rooms, resolvedBindings.rooms),
    [floor.rooms, resolvedBindings.rooms],
  );
  const initialSession = useRef(
    readSceneSession(typeof window === "undefined" ? null : window.sessionStorage),
  );
  const validInitialRoom = floor.rooms.some(
    (room) => room.id === initialSession.current.selectedRoomId,
  )
    ? initialSession.current.selectedRoomId
    : null;
  const [mode, setMode] = useState<SceneMode>(
    walkthrough || (initialSession.current.mode === "room" && !validInitialRoom)
      ? "overview"
      : initialSession.current.mode,
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(validInitialRoom);
  const [walkRoomId, setWalkRoomId] = useState<string | null>(validInitialRoom);
  const [wallFadeEnabled, setWallFadeEnabled] = useState(initialSession.current.wallFadeEnabled);
  const [lightingMode, setLightingMode] = useState<SolarLightingMode>(loadLightingMode);
  const chooseLightingMode = (mode: SolarLightingMode) => {
    setLightingMode(mode);
    saveLightingMode(mode);
  };
  const [localTime, setLocalTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setLocalTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [roomFocusKey, setRoomFocusKey] = useState(0);
  const [automaticOpeningIds, setAutomaticOpeningIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [devicePanelRoomId, setDevicePanelRoomId] = useState<string | null>(null);
  const [walkDeviceTarget, setWalkDeviceTarget] = useState<ExtensionInteractionTarget | null>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingView, setMappingView] = useState<"rooms" | "devices">("rooms");
  const [allLightsBusy, setAllLightsBusy] = useState(false);
  const [sceneActionError, setSceneActionError] = useState<string | null>(null);
  const lastBoundOpenRef = useRef<RetainedOpeningPositions>(new Map());
  const coarsePointer = useCoarsePointer();
  const reducedMotion = useReducedMotion();
  const documentVisible = useDocumentVisible();
  const { liveCameraDeviceIds, cameraStreamRequirements } = useSceneCameraRequirements(
    manifest,
    deviceModels,
    resolvedBindings,
    runtime.origin,
  );
  const selectedRoom = floor.rooms.find((room) => room.id === selectedRoomId);
  const devicePanelRoom = floor.rooms.find((room) => room.id === devicePanelRoomId);
  const deviceOverlay = selectedDeviceId !== null && devicePanelRoom !== undefined;
  const controlRoom = deviceOverlay ? devicePanelRoom : mode === "room" ? selectedRoom : undefined;
  const walkRoom = floor.rooms.find((room) => room.id === walkRoomId);
  const selectedRoomDisplayName = selectedRoom
    ? (resolvedBindings.rooms[selectedRoom.id]?.displayName ?? selectedRoom.name)
    : floor.name;
  const walkRoomDisplayName = walkRoom
    ? (resolvedBindings.rooms[walkRoom.id]?.displayName ?? walkRoom.name)
    : floor.name;
  const walkMode = mode === "walk";
  const walk = useDashboardWalk({
    manifest,
    floor,
    selectedRoomId,
    selectedRoom,
    walkMode,
    deviceOverlay,
    coarsePointer,
    walkthrough,
    setMode,
    setWalkRoomId,
    setAutomaticOpeningIds,
    setSelectedDeviceId,
    setDevicePanelRoomId,
    setSceneActionError,
    floorNavigationSelectFloor,
    setWalkDeviceTarget,
  });
  const {
    walkPointerLocked,
    shellRef,
    walkDevicePanelOpenRef,
    poseRef,
    sprintInputRef,
    jumpRequestRef,
    movementInputRef,
    lookInputRef,
    lookDeltaRef,
    requestWalkPointerLock,
    enterWalkMode,
    leaveWalkMode,
    requestMobileLandscape,
  } = walk;
  const { quality, canvasDpr, adjustQuality } = useAdaptiveSceneQuality(coarsePointer, walkMode);
  const openingPositions = useMemo(
    () =>
      resolveOpeningPositions(
        automaticOpeningIds,
        resolvedBindings.openings,
        lastBoundOpenRef.current,
      ),
    [automaticOpeningIds, resolvedBindings.openings],
  );
  const sunState = runtime.entityStates["sun.sun"];
  const solarLighting = resolveSolarLighting(lightingMode, sunState, localTime);
  const nightLighting = solarLighting.night;
  const allLightsCall = allLightsOffCall(runtime.entityStates);
  useEffect(() => {
    if (walkthrough) return;
    writeSceneSession(window.sessionStorage, { mode, selectedRoomId, wallFadeEnabled });
  }, [mode, selectedRoomId, wallFadeEnabled, walkthrough]);

  const selectRoom = useCallback(
    (roomId: string) => {
      if (walkthrough) return;
      setRoomFocusKey((key) => key + 1);
      setSelectedRoomId(roomId);
      setSelectedDeviceId(null);
      setDevicePanelRoomId(null);
      walkDevicePanelOpenRef.current = false;
      setMode("room");
    },
    [walkDevicePanelOpenRef, walkthrough],
  );
  const goHome = useCallback(() => {
    setRoomFocusKey((key) => key + 1);
    movementInputRef.current = { x: 0, y: 0 };
    lookInputRef.current = { x: 0, y: 0 };
    lookDeltaRef.current = { x: 0, y: 0 };
    setAutomaticOpeningIds(new Set());
    setSelectedRoomId(null);
    setSelectedDeviceId(null);
    setDevicePanelRoomId(null);
    walkDevicePanelOpenRef.current = false;
    setMode("overview");
  }, [lookDeltaRef, lookInputRef, movementInputRef, walkDevicePanelOpenRef]);

  const {
    selectedCamera,
    setSelectedCamera,
    closeCameraViewer,
    openCameraViewer,
    closeDevicePanel,
    handleExtensionInteraction,
    openWalkDevice,
  } = useDashboardDeviceInteraction({
    manifest,
    floor,
    runtime,
    resolvedBindings,
    deviceModels,
    onOpenConnect,
    walkthrough,
    walkMode,
    coarsePointer,
    equippedToolId,
    walk,
    setDevicePanelRoomId,
    setSelectedDeviceId,
    setSelectedRoomId,
    setMode,
    setMappingOpen,
    walkDeviceTarget,
    setWalkDeviceTarget,
    selectedDeviceId,
  });
  useEffect(() => {
    if (!setupOpen) return;
    setMappingOpen(false);
    setSelectedCamera(null);
    goHome();
  }, [goHome, setSelectedCamera, setupOpen]);

  useEffect(() => {
    if (!mappingRequest) return;
    if (onOpenConnect) {
      onOpenConnect(mappingRequest.view, mappingRequest.roomId);
      return;
    }
    setMappingView(mappingRequest.view);
    setSelectedRoomId(mappingRequest.roomId ?? null);
    setSelectedDeviceId(null);
    setDevicePanelRoomId(null);
    setMappingOpen(true);
  }, [mappingRequest, onOpenConnect]);
  const runAction = (action: BuiltInShortcutId) => {
    switch (action) {
      case "home-view":
        goHome();
        break;
      case "room-details":
        if (walkRoomId) selectRoom(walkRoomId);
        else if (floor.rooms[0]) selectRoom(floor.rooms[0].id);
        break;
      case "construct-mode":
        onEditHome?.("construct");
        break;
      case "arrange-mode":
        onEditHome?.("furnish");
        break;
      case "connect-mode":
        if (onEditHome) onEditHome("connect");
        else if (onOpenConnect) onOpenConnect("rooms");
        else {
          setMappingView("rooms");
          setMappingOpen(true);
        }
        break;
      case "walk-mode":
        if (walkMode) leaveWalkMode();
        else if (coarsePointer && !window.matchMedia("(orientation: landscape)").matches) {
          requestMobileLandscape();
        } else enterWalkMode();
        break;
      case "lighting-mode":
        chooseLightingMode(nightLighting ? "day" : "night");
        break;
      case "wall-fade":
        setWallFadeEnabled((current) => !current);
        break;
      case "all-lights":
        if (!runtime.canMutate || !allLightsCall || allLightsBusy) break;
        setAllLightsBusy(true);
        setSceneActionError(null);
        void runtime
          .callService(allLightsCall)
          .catch(() => {
            setSceneActionError("Home Assistant could not turn off every available light.");
          })
          .finally(() => setAllLightsBusy(false));
        break;
    }
  };
  const haActions = useHaActionShortcuts(runtime, bindingManager.profile, setSceneActionError);
  const pendingHaActions = haActions.pending;
  const runConfiguredAction = (item: ActionBarItem) => {
    if (item.target.kind === "scene" || item.target.kind === "script") {
      void haActions.run(item);
      return;
    }
    if (item.target.kind === "walk-tool") {
      const toolId = item.target.toolId;
      if (walkMode && walkTools.some((tool) => tool.id === toolId)) {
        setEquippedToolId((current) => (current === toolId ? null : toolId));
        requestWalkPointerLock();
      }
      return;
    }
    if (item.target.kind === "built-in") {
      const action = {
        walk: "walk-mode",
        night: "lighting-mode",
        "all-lights": "all-lights",
      } as const;
      if (item.target.action in action)
        runAction(action[item.target.action as keyof typeof action]);
      return;
    }
    const destination = resolveActionBarDestination(manifest, item.target);
    if (!destination) {
      setSceneActionError(
        `This ${item.target.kind} is no longer available. Edit the action bar to replace it.`,
      );
      return;
    }
    openActionBarDestination(destination, {
      walkMode,
      leaveWalkMode,
      selectFloor: floorNavigationSelectFloor,
      selectRoom,
      openDevice: (roomId, deviceId) => {
        setDevicePanelRoomId(roomId);
        setSelectedDeviceId(deviceId);
      },
    });
    setSceneActionError(null);
  };
  const handleAutomaticOpeningsChange = (next: ReadonlySet<string>) => {
    setAutomaticOpeningIds(new Set([...next].filter((openingId) => doorOpeningIds.has(openingId))));
  };
  // A focus request selects a room once; later floor and selection changes remain user controlled.
  const focusRequestedRoom = useEffectEvent(() => {
    if (!focusRoomId) return;
    const targetFloor = manifest.floors.find((candidate) =>
      candidate.rooms.some((room) => room.id === focusRoomId),
    );
    if (!targetFloor) return;
    floorNavigationSelectFloor(targetFloor.id);
    selectRoom(focusRoomId);
  });
  useEffect(() => {
    focusRequestedRoom();
  }, [focusRoomId]);

  useEffect(() => {
    if (!walkMode || !walkTools.some((tool) => tool.id === equippedToolId)) setEquippedToolId(null);
  }, [walkMode, walkTools, equippedToolId]);
  const runKeyboardAction = useEffectEvent(runAction);
  useEffect(() => {
    if (walkMode || walkthrough || setupOpen || mappingOpen || deviceOverlay || selectedCamera)
      return;
    const activateEditorShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select") || target.isContentEditable)
      )
        return;
      const action = orbitalEditorActionFromKey(event.key, event.shiftKey);
      if (!action) return;
      event.preventDefault();
      runKeyboardAction(action);
    };
    dom.events.addEventListener("keydown", activateEditorShortcut);
    return () => dom.events.removeEventListener("keydown", activateEditorShortcut);
  }, [deviceOverlay, mappingOpen, mode, selectedCamera, setupOpen, walkMode, walkthrough, dom]);
  return {
    equippedToolId,
    floorNavigation,
    elevation,
    setCameraResetKey,
    requestWalkPointerLock,
    cameraStreamRequirements,
    runtime,
    documentVisible,
    shellRef,
    mode,
    mappingOpen,
    setupOpen,
    manifest,
    canvasDpr,
    walkMode,
    quality,
    lightingMode,
    chooseLightingMode,
    sunState,
    solarLighting,
    nightLighting,
    floor,
    poseRef,
    movementInputRef,
    sprintInputRef,
    jumpRequestRef,
    lookInputRef,
    lookDeltaRef,
    reducedMotion,
    openingPositions,
    resolvedBindings,
    handleAutomaticOpeningsChange,
    setWalkRoomId,
    selectedRoom,
    cameraResetKey,
    roomFocusKey,
    architectureModels,
    selectedRoomId,
    wallFadeEnabled,
    deviceModels,
    selectRoom,
    handleExtensionInteraction,
    walkthrough,
    setWalkDeviceTarget,
    roomStatuses,
    roomDisplayNames,
    coarsePointer,
    adjustQuality,
    walkRoomDisplayName,
    selectedRoomDisplayName,
    walkRoomId,
    homePresence,
    sessionPresentation,
    demoSession,
    setupAction,
    setMappingOpen,
    goHome,
    onExportBrowserData,
    controlRoom,
    selectedDeviceId,
    deviceOverlay,
    closeDevicePanel,
    setSelectedDeviceId,
    enterWalkMode,
    onOpenConnect,
    setMappingView,
    liveCameraDeviceIds,
    openCameraViewer,
    bindingManager,
    mappingView,
    selectedCamera,
    closeCameraViewer,
    setSelectedCamera,
    setSelectedRoomId,
    setMode,
    walkDeviceTarget,
    openWalkDevice,
    walkPointerLocked,
    allLightsCall,
    allLightsBusy,
    runAction,
    runConfiguredAction,
    sceneActionError,
    setSceneActionError,
    pendingHaActions,
  };
}
