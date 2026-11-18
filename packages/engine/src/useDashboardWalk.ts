import { homeGroundFrame } from "./architecture-scene/diorama-frame";
import { createWalkParcel } from "./navigation/walk-parcel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCabaneDom } from "./CabaneDom";
import { useFloorNavigation } from "./building";
import { pointInsidePolygon, worldPointToPlan } from "./geometry";
import { requestWalkPointerLock as acquireWalkPointerLock } from "./request-walk-pointer-lock";
import { safeBuildingSpawn } from "./stairs/stair-navigation";

import { spawnPoseForRoom, type StickVector, type WalkPose } from "./navigation";

import { useDesktopWalkInput } from "./SceneControls";

import type { ExtensionInteractionTarget, PlanPoint, SceneMode } from "./types";

import { ValidatedDashboardProps } from "./validated-dashboard-contract";

type Options = {
  manifest: ValidatedDashboardProps["manifest"];
  deviceModels: ValidatedDashboardProps["deviceModels"];
  floor: ValidatedDashboardProps["manifest"]["floors"][number];
  selectedRoomId: string | null;
  selectedRoom: ValidatedDashboardProps["manifest"]["floors"][number]["rooms"][number] | undefined;
  walkMode: boolean;
  deviceOverlay: boolean;
  coarsePointer: boolean;
  walkthrough: ValidatedDashboardProps["walkthrough"];
  setMode: React.Dispatch<React.SetStateAction<SceneMode>>;
  setWalkRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setAutomaticOpeningIds: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
  setSelectedDeviceId: React.Dispatch<React.SetStateAction<string | null>>;
  setDevicePanelRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setSceneActionError: React.Dispatch<React.SetStateAction<string | null>>;
  floorNavigationSelectFloor: ReturnType<typeof useFloorNavigation>["selectFloor"];
  setWalkDeviceTarget: React.Dispatch<React.SetStateAction<ExtensionInteractionTarget | null>>;
};
export function useDashboardWalk({
  manifest,
  deviceModels,
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
}: Options) {
  const dom = useCabaneDom();
  const parcel = useMemo(() => {
    const frame = homeGroundFrame(manifest, deviceModels, "walk");
    return frame ? createWalkParcel(frame) : undefined;
  }, [manifest, deviceModels]);
  const findWalkSpawn = useCallback(
    (floorId: string, at?: PlanPoint) =>
      safeBuildingSpawn(manifest, floorId, at, undefined, undefined, parcel),
    [manifest, parcel],
  );
  const unavailableFloors = useMemo(
    () =>
      walkMode
        ? Object.fromEntries(
            manifest.floors
              .filter((floor) => !findWalkSpawn(floor.id))
              .map((floor) => [floor.id, "No clear walking entry"]),
          )
        : undefined,
    [walkMode, manifest.floors, findWalkSpawn],
  );
  const onExitWalkthrough = walkthrough?.onExit;
  const walkthroughStarted = useRef(false);
  const [walkPointerLocked, setWalkPointerLocked] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const mobileOrientationLockRef = useRef(false);
  const mobileFullscreenRef = useRef(false);
  const walkDevicePanelOpenRef = useRef(false);
  const walkPointerLockPendingRef = useRef(false);
  const poseRef = useRef<WalkPose>(spawnPoseForRoom(selectedRoom, floor));
  const sprintInputRef = useRef(false);
  const jumpRequestRef = useRef(false);
  const movementInputRef = useRef<StickVector>({ x: 0, y: 0 });
  const lookInputRef = useRef<StickVector>({ x: 0, y: 0 });
  const lookDeltaRef = useRef<StickVector>({ x: 0, y: 0 });
  const requestWalkPointerLock = useCallback(() => {
    const target = walkthrough?.pointerLockTarget ?? shellRef.current;
    if (coarsePointer || !target || dom.root.pointerLockElement === target) return;
    lookDeltaRef.current = { x: 0, y: 0 };
    walkPointerLockPendingRef.current = true;
    void acquireWalkPointerLock(target).catch(() => {
      walkPointerLockPendingRef.current = false;
      setSceneActionError("Click the scene to resume mouse control.");
    });
  }, [walkthrough, coarsePointer, dom, setSceneActionError]);
  useDesktopWalkInput(
    walkMode && walkPointerLocked && !coarsePointer && !deviceOverlay,
    movementInputRef,
    sprintInputRef,
    jumpRequestRef,
  );

  useEffect(() => {
    if ((!walkMode && !onExitWalkthrough) || deviceOverlay) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || walkDevicePanelOpenRef.current)
        return;
      if (onExitWalkthrough) onExitWalkthrough();
      else setMode(selectedRoomId ? "room" : "overview");
    };
    dom.events.addEventListener("keydown", exit);
    return () => dom.events.removeEventListener("keydown", exit);
  }, [deviceOverlay, onExitWalkthrough, selectedRoomId, walkMode, dom, setMode]);

  useEffect(() => {
    const shell = walkthrough?.pointerLockTarget ?? shellRef.current;
    if (!walkMode || coarsePointer) {
      if (!walkMode && !walkthrough && dom.root.pointerLockElement === shell)
        document.exitPointerLock();
      return;
    }
    let acquired = dom.root.pointerLockElement === shell;
    const syncPointerLock = () => {
      const locked = dom.root.pointerLockElement === shell;
      setWalkPointerLocked(locked);
      if (locked) {
        acquired = true;
        setSceneActionError((current) =>
          current === "Click the scene to resume mouse control." ? null : current,
        );
        walkPointerLockPendingRef.current = false;
        return;
      }
      // Do not interrupt an overlay or an in-flight browser request.
      if (!acquired || walkDevicePanelOpenRef.current || walkPointerLockPendingRef.current) return;
      // Losing browser pointer lock pauses input; it must not replace the camera.
      movementInputRef.current = { x: 0, y: 0 };
      lookDeltaRef.current = { x: 0, y: 0 };
    };
    syncPointerLock();
    document.addEventListener("pointerlockchange", syncPointerLock);
    return () => {
      document.removeEventListener("pointerlockchange", syncPointerLock);
      queueMicrotask(() => {
        if (shell && !shell.isConnected && dom.root.pointerLockElement === shell)
          document.exitPointerLock();
      });
    };
  }, [
    coarsePointer,
    onExitWalkthrough,
    selectedRoomId,
    walkMode,
    walkthrough,
    dom,
    setSceneActionError,
  ]);

  const enterWalkMode = useCallback(() => {
    walkDevicePanelOpenRef.current = false;
    walkPointerLockPendingRef.current = false;
    const start = manifest.home.walkStart;
    const safeSpawn = findWalkSpawn(start?.floorId ?? floor.id, start?.at);
    if (!safeSpawn) {
      setSceneActionError(
        "The walk starting area is blocked or unavailable. Move the starting point in Construct or clear a walking area in Arrange.",
      );
      return;
    }
    floorNavigationSelectFloor(safeSpawn.floorId);
    requestWalkPointerLock();
    poseRef.current = safeSpawn;
    const spawnFloor = manifest.floors.find((candidate) => candidate.id === safeSpawn.floorId)!;
    const spawnPoint = worldPointToPlan(safeSpawn, manifest.coordinates);
    setWalkRoomId(
      spawnFloor.rooms.find((room) => pointInsidePolygon(spawnPoint, room.polygon))?.id ?? null,
    );
    setAutomaticOpeningIds(new Set());
    setSelectedDeviceId(null);
    setDevicePanelRoomId(null);
    setSceneActionError(null);
    setMode("walk");
  }, [
    findWalkSpawn,
    floor.id,
    floorNavigationSelectFloor,
    manifest,
    requestWalkPointerLock,
    setAutomaticOpeningIds,
    setDevicePanelRoomId,
    setMode,
    setSceneActionError,
    setSelectedDeviceId,
    setWalkRoomId,
  ]);

  const leaveWalkMode = useCallback(() => {
    movementInputRef.current = { x: 0, y: 0 };
    lookInputRef.current = { x: 0, y: 0 };
    lookDeltaRef.current = { x: 0, y: 0 };
    setAutomaticOpeningIds(new Set());
    setWalkDeviceTarget(null);
    setWalkPointerLocked(false);
    if (dom.root.pointerLockElement) document.exitPointerLock();
    walkPointerLockPendingRef.current = false;
    if (onExitWalkthrough) {
      onExitWalkthrough();
      return;
    }
    setMode(selectedRoomId ? "room" : "overview");
  }, [
    setAutomaticOpeningIds,
    setWalkDeviceTarget,
    dom,
    onExitWalkthrough,
    setMode,
    selectedRoomId,
  ]);

  useEffect(() => {
    if (!coarsePointer) return;
    const landscape = window.matchMedia("(orientation: landscape)");
    const updateWalkMode = () => {
      if (landscape.matches) enterWalkMode();
      else if (walkMode) leaveWalkMode();
    };
    if (!landscape.matches && walkMode) leaveWalkMode();
    landscape.addEventListener("change", updateWalkMode);
    return () => landscape.removeEventListener("change", updateWalkMode);
  }, [coarsePointer, enterWalkMode, leaveWalkMode, walkMode]);

  useEffect(() => {
    if (walkMode) return;
    if (mobileOrientationLockRef.current) {
      mobileOrientationLockRef.current = false;
      try {
        screen.orientation.unlock();
      } catch {
        // The browser may already have released the lock after leaving fullscreen.
      }
    }
    if (mobileFullscreenRef.current) {
      mobileFullscreenRef.current = false;
      if (dom.root.fullscreenElement === shellRef.current) {
        void document.exitFullscreen().catch(() => undefined);
      }
    }
  }, [walkMode, dom]);

  const requestMobileLandscape = useCallback(() => {
    setSceneActionError("Rotate your device to landscape to use walk mode.");
    // Keep the editor's return bar visible instead of making only the scene fullscreen.
    if (walkthrough || typeof screen.orientation?.lock !== "function") return;
    void (async () => {
      try {
        if (!dom.root.fullscreenElement && shellRef.current?.requestFullscreen) {
          await shellRef.current.requestFullscreen();
          mobileFullscreenRef.current = true;
        }
        await screen.orientation.lock("landscape");
        mobileOrientationLockRef.current = true;
      } catch {
        if (mobileFullscreenRef.current && dom.root.fullscreenElement === shellRef.current) {
          mobileFullscreenRef.current = false;
          void document.exitFullscreen().catch(() => undefined);
        }
      }
    })();
  }, [setSceneActionError, walkthrough, dom]);

  useEffect(() => {
    if (!onExitWalkthrough || walkthroughStarted.current) return;
    // The pointer hook resolves after mount; wait before requesting desktop input on touch devices.
    const touch =
      window.matchMedia("(any-pointer: coarse)").matches && navigator.maxTouchPoints > 0;
    if (touch && !coarsePointer) return;
    walkthroughStarted.current = true;
    if (coarsePointer && !window.matchMedia("(orientation: landscape)").matches)
      requestMobileLandscape();
    else enterWalkMode();
  }, [coarsePointer, enterWalkMode, onExitWalkthrough, requestMobileLandscape]);

  return {
    findWalkSpawn,
    unavailableFloors,
    parcel,
    walkPointerLocked,
    shellRef,
    walkDevicePanelOpenRef,
    walkPointerLockPendingRef,
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
  };
}
