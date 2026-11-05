import { useMemo } from "react";
import {
  cameraEntityAvailable,
  cameraPosterUrl,
  deduplicateCameraStreamRequirements,
} from "./camera-stream";
import type { CameraStreamRequirement } from "./CameraStreamCoordinator";
import { resolveDeviceModelDefinition } from "./devices";
import type { DeviceModelRegistry, HomeManifest, ResolvedHomeBindings } from "./types";
export function useSceneCameraRequirements(
  manifest: HomeManifest,
  deviceModels: DeviceModelRegistry,
  resolvedBindings: ResolvedHomeBindings,
  origin: string | null,
) {
  return useMemo(() => {
    const liveCameraDeviceIds = new Set<string>();
    const requirements: CameraStreamRequirement[] = [];
    Object.values(resolvedBindings.rooms).forEach((resolvedRoom) => {
      resolvedRoom.devices.forEach((device) => {
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
        if (primary && !primary.entityId.startsWith("camera.")) return;
        liveCameraDeviceIds.add(device.slot.id);
        if (!primary) return;
        requirements.push({
          entityId: primary.entityId,
          available: cameraEntityAvailable(primary.state),
          posterUrl: cameraPosterUrl(primary.state, origin),
        });
      });
    });
    return {
      liveCameraDeviceIds,
      cameraStreamRequirements: deduplicateCameraStreamRequirements(requirements),
    };
  }, [deviceModels, manifest.extensions.deviceModels, resolvedBindings.rooms, origin]);
}
