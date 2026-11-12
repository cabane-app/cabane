import type { ActionBarItem } from "./action-bar-config";
import type {
  HomeManifest,
  RuntimeBindingProfile,
  HomeAssistantRuntimeSnapshot,
  ResolvedHomeBindings,
  DeviceModelRegistry,
} from "../types";
import { resolveHaActionShortcut } from "./ha-action-shortcuts";
import { resolveActionBarDestination } from "./action-bar-navigation";
export interface ResolvedActionBarTarget {
  label: string;
  available: boolean;
  pending?: boolean;
  reason?: string | undefined;
  pictureUrl?: string | null | undefined;
  modelId?: string | undefined;
}
export function resolveDashboardActionTargets(
  actionBarItems: readonly ActionBarItem[],
  manifest: HomeManifest,
  profile: RuntimeBindingProfile,
  runtime: HomeAssistantRuntimeSnapshot,
  resolvedBindings: ResolvedHomeBindings,
  deviceModels: DeviceModelRegistry,
  pendingHaActions: ReadonlySet<string>,
): Readonly<Record<string, ResolvedActionBarTarget>> {
  return Object.fromEntries(
    actionBarItems.flatMap<[string, ResolvedActionBarTarget]>((item) => {
      if (
        item.target.kind === "built-in" ||
        item.target.kind === "walk-tool" ||
        item.target.kind === "scene-feature"
      )
        return [];
      if (item.target.kind === "scene" || item.target.kind === "script") {
        const target = resolveHaActionShortcut(item, profile, runtime);
        const pending = pendingHaActions.has(item.id);
        return [[item.id, { ...target, pending, available: target.available && !pending }]];
      }
      const destination = resolveActionBarDestination(manifest, item.target);
      if (!destination)
        return [[item.id, { label: `Unavailable ${item.target.kind}`, available: false }]];
      if (item.target.kind === "room") {
        const room = manifest.floors
          .find((floor) => floor.id === destination.floorId)
          ?.rooms.find((room) => room.id === destination.roomId);
        return [
          [
            item.id,
            {
              label:
                resolvedBindings.rooms[destination.roomId]?.displayName ?? room?.name ?? "Room",
              pictureUrl: resolvedBindings.rooms[destination.roomId]?.pictureUrl,
              available: true,
            },
          ],
        ];
      }
      const deviceId = item.target.deviceId;
      const device = manifest.sceneItems.find((candidate) => candidate.id === deviceId);
      return [
        [
          item.id,
          {
            label:
              resolvedBindings.rooms[destination.roomId]?.devices.find(
                (binding) => binding.slot.id === deviceId,
              )?.displayName ??
              (device
                ? (deviceModels[device.modelId]?.label ?? device.modelId.replaceAll("-", " "))
                : "Device"),
            modelId: device?.modelId,
            available: true,
          },
        ],
      ];
    }),
  );
}
