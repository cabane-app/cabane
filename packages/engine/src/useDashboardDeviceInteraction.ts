import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCabaneDom } from "./CabaneDom";
import { collectBindingSlots } from "./binding-slot-descriptors";
import { useDashboardWalk } from "./useDashboardWalk";

import { resolveDeviceModelDefinition } from "./devices";

import { useHomeAssistantRuntime } from "./HomeAssistantRuntime";

import { resolveHomeAssistantBindings } from "./home-assistant-resolver";
import { orbitLightCall } from "./orbit-light-control";

import type { EntityId, ExtensionInteractionTarget, RoomSpec, SceneMode } from "./types";

import { ValidatedDashboardProps } from "./validated-dashboard-contract";

type Options = {
  manifest: ValidatedDashboardProps["manifest"];
  floor: ValidatedDashboardProps["manifest"]["floors"][number];
  outsideRoom?: RoomSpec | undefined;
  runtime: ReturnType<typeof useHomeAssistantRuntime>;
  resolvedBindings: ReturnType<typeof resolveHomeAssistantBindings>;
  deviceModels: ValidatedDashboardProps["deviceModels"];
  onOpenConnect: ValidatedDashboardProps["onOpenConnect"];
  walkthrough: ValidatedDashboardProps["walkthrough"];
  walkMode: boolean;
  orbitBlocked?: boolean;
  coarsePointer: boolean;
  equippedToolId: string | null;
  walk: ReturnType<typeof useDashboardWalk>;
  setDevicePanelRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedDeviceId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setMode: React.Dispatch<React.SetStateAction<SceneMode>>;
  setMappingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  walkDeviceTarget: ExtensionInteractionTarget | null;
  setWalkDeviceTarget: React.Dispatch<React.SetStateAction<ExtensionInteractionTarget | null>>;
  selectedDeviceId: string | null;
};
export function useDashboardDeviceInteraction({
  manifest,
  floor,
  outsideRoom,
  runtime,
  resolvedBindings,
  deviceModels,
  onOpenConnect,
  walkthrough,
  walkMode,
  orbitBlocked,
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
}: Options) {
  const dom = useCabaneDom();
  const {
    shellRef,
    walkDevicePanelOpenRef,
    walkPointerLockPendingRef,
    movementInputRef,
    lookInputRef,
    lookDeltaRef,
    requestWalkPointerLock,
  } = walk;
  const [selectedCamera, setSelectedCamera] = useState<{
    roomId: string;
    deviceId: string;
    entityId: EntityId;
    label: string;
  } | null>(null);
  const closeCameraViewer = useCallback(() => setSelectedCamera(null), []);
  const openCameraViewer = useCallback(
    (roomId: string, deviceId: string) => {
      const resolvedRoom = resolvedBindings.rooms[roomId];
      const device = resolvedRoom?.devices.find((candidate) => candidate.slot.id === deviceId);
      if (!device) return;
      const definition = resolveDeviceModelDefinition(
        device.slot.model,
        deviceModels,
        manifest.extensions.deviceModels,
      );
      if (definition?.liveMedia?.kind !== "camera-stream") return;
      const primarySlot = device.slot.entitySlots.find(
        (slot) => slot.deviceRole === definition.liveMedia?.slotRole,
      );
      const primary = device.entities.find((entity) => entity.slotId === primarySlot?.id);
      const invalid = device.issues.some((issue) => issue.severity === "error");
      if (!primary || invalid || !primary.entityId.startsWith("camera.")) {
        if (onOpenConnect) {
          onOpenConnect("devices", roomId);
          return;
        }
        setSelectedCamera(null);
        if (resolvedRoom?.outsideFloorId !== undefined) {
          setDevicePanelRoomId(roomId);
          setSelectedDeviceId(deviceId);
          return;
        }
        setSelectedRoomId(roomId);
        setSelectedDeviceId(deviceId);
        setMode("room");
        setMappingOpen(true);
        if (runtime.status !== "connected") runtime.connect();
        return;
      }
      setSelectedCamera({
        roomId,
        deviceId,
        entityId: primary.entityId,
        label: primarySlot?.presentation.label ?? device.slot.id,
      });
    },
    [
      resolvedBindings.rooms,
      deviceModels,
      manifest.extensions.deviceModels,
      onOpenConnect,
      setDevicePanelRoomId,
      setSelectedRoomId,
      setSelectedDeviceId,
      setMode,
      setMappingOpen,
      runtime,
    ],
  );
  const closeDevicePanel = useCallback(
    (pointerLockTiming: "immediate" | "after-escape" = "immediate") => {
      setSelectedDeviceId(null);
      setDevicePanelRoomId(null);
      if (!walkMode || coarsePointer) {
        walkDevicePanelOpenRef.current = false;
        return;
      }
      const resumeWalk = () => {
        walkDevicePanelOpenRef.current = false;
        requestWalkPointerLock();
      };
      if (pointerLockTiming === "after-escape") window.setTimeout(resumeWalk, 0);
      else resumeWalk();
    },
    [
      coarsePointer,
      requestWalkPointerLock,
      setDevicePanelRoomId,
      setSelectedDeviceId,
      walkDevicePanelOpenRef,
      walkMode,
    ],
  );
  const openDevicePanel = useCallback(
    (roomId: string, deviceId: string | null) => {
      setDevicePanelRoomId(roomId);
      setSelectedDeviceId(deviceId);
      if (!walkMode) return;
      movementInputRef.current = { x: 0, y: 0 };
      lookInputRef.current = { x: 0, y: 0 };
      lookDeltaRef.current = { x: 0, y: 0 };
      walkDevicePanelOpenRef.current = true;
      walkPointerLockPendingRef.current = false;
      if (dom.root.pointerLockElement === shellRef.current) document.exitPointerLock();
    },
    [
      setDevicePanelRoomId,
      setSelectedDeviceId,
      walkMode,
      movementInputRef,
      lookInputRef,
      lookDeltaRef,
      walkDevicePanelOpenRef,
      walkPointerLockPendingRef,
      dom,
      shellRef,
    ],
  );
  const deviceRooms = useMemo(
    () => (outsideRoom ? [...floor.rooms, outsideRoom] : floor.rooms),
    [floor.rooms, outsideRoom],
  );
  const orbitEnabled =
    !walkthrough && !walkMode && !orbitBlocked && !selectedCamera && !selectedDeviceId;
  const orbitScope = useRef<symbol | null>(null);
  useLayoutEffect(() => {
    orbitScope.current = orbitEnabled ? Symbol() : null;
    return () => {
      orbitScope.current = null;
    };
  }, [floor.id, manifest.home.id, orbitEnabled, runtime.origin]);

  const handleExtensionInteraction = useCallback(
    (target: ExtensionInteractionTarget) => {
      if (walkthrough || (walkMode && equippedToolId)) return;
      if (!walkMode && (target.intent === "light-toggle" || target.intent === "light-dim")) {
        if (!runtime.canMutate || !orbitEnabled) return;
        const room = deviceRooms.find((candidate) =>
          candidate.devices.some((device) => device.id === target.id),
        );
        const device =
          room &&
          resolvedBindings.rooms[room.id]?.devices.find(
            (candidate) => candidate.slot.id === target.id,
          );
        const call = device && orbitLightCall(device, target);
        if (call && room) {
          const scope = orbitScope.current;
          void runtime.callService(call).catch(() => {
            if (scope && orbitScope.current === scope) openDevicePanel(room.id, target.id);
          });
        }
        return;
      }
      const openingDescriptor = collectBindingSlots(manifest).find(
        (descriptor) => descriptor.kind === "opening-cover" && descriptor.openingId === target.id,
      );
      const room = deviceRooms.find(
        (candidate) =>
          openingDescriptor?.roomIds.includes(candidate.id) ||
          candidate.devices.some(
            (device) =>
              device.id === target.id ||
              (target.slotId
                ? device.entitySlots.some((slot) => slot.id === target.slotId)
                : false),
          ) ||
          (target.slotId
            ? candidate.dashboardSlots.some((slot) => slot.id === target.slotId)
            : false),
      );
      if (!room) return;
      const device = room.devices.find(
        (candidate) =>
          candidate.id === target.id ||
          (target.slotId ? candidate.entitySlots.some((slot) => slot.id === target.slotId) : false),
      );
      if (device && target.intent === "camera-viewer") {
        openCameraViewer(room.id, device.id);
        return;
      }
      if (device) {
        openDevicePanel(room.id, device.id);
        return;
      }
      if (room === outsideRoom) return;
      setSelectedRoomId(room.id);
      setSelectedDeviceId(null);
      setDevicePanelRoomId(null);
      setMode("room");
    },
    [
      walkthrough,
      walkMode,
      equippedToolId,
      manifest,
      deviceRooms,
      outsideRoom,
      orbitEnabled,
      setSelectedRoomId,
      setSelectedDeviceId,
      setDevicePanelRoomId,
      setMode,
      openCameraViewer,
      openDevicePanel,
      runtime,
      resolvedBindings.rooms,
    ],
  );
  const openWalkDevice = useCallback(() => {
    if (!walkDeviceTarget || walkthrough || equippedToolId) return;
    if (floor.openings.some((opening) => opening.id === walkDeviceTarget.id && opening.coverSlot)) {
      handleExtensionInteraction(walkDeviceTarget);
      setWalkDeviceTarget(null);
      if (dom.root.pointerLockElement) document.exitPointerLock();
      return;
    }
    const room = deviceRooms.find((candidate) =>
      candidate.devices.some((device) => device.id === walkDeviceTarget.id),
    );
    if (!room) return;
    setWalkDeviceTarget(null);
    openDevicePanel(room.id, walkDeviceTarget.id);
  }, [
    walkDeviceTarget,
    floor.openings,
    deviceRooms,
    walkthrough,
    equippedToolId,
    setWalkDeviceTarget,
    openDevicePanel,
    handleExtensionInteraction,
    dom,
  ]);

  useEffect(() => {
    if (
      walkthrough ||
      !walkMode ||
      !walkDeviceTarget ||
      coarsePointer ||
      equippedToolId ||
      selectedDeviceId
    )
      return;
    const activateWithKeyboard = (event: KeyboardEvent) => {
      if (event.code !== "KeyE" && event.code !== "Enter") return;
      event.preventDefault();
      openWalkDevice();
    };
    const activateWithPointer = (event: PointerEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        dom.root.pointerLockElement !== shellRef.current
      )
        return;
      openWalkDevice();
    };
    dom.events.addEventListener("keydown", activateWithKeyboard);
    dom.events.addEventListener("pointerdown", activateWithPointer);
    return () => {
      dom.events.removeEventListener("keydown", activateWithKeyboard);
      dom.events.removeEventListener("pointerdown", activateWithPointer);
    };
  }, [
    coarsePointer,
    equippedToolId,
    openWalkDevice,
    selectedDeviceId,
    walkDeviceTarget,
    walkMode,
    walkthrough,
    dom,
    shellRef,
  ]);
  return {
    selectedCamera,
    setSelectedCamera,
    closeCameraViewer,
    openCameraViewer,
    closeDevicePanel,
    openDevicePanel,
    handleExtensionInteraction,
    openWalkDevice,
  };
}
