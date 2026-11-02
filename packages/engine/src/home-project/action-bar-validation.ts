import { roomsForFloor } from "../outdoor-platforms/platform-rooms";
import type { DeviceModelRegistry } from "../types";
import type { ActionBarItem } from "../action-bar/action-bar-config";
import type { HomeProject } from "./types";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

const targetKey = (item: ActionBarItem): string => {
  const target = item.target;
  return target.kind === "built-in"
    ? `built-in:${target.action}`
    : target.kind === "walk-tool"
      ? `walk-tool:${target.toolId}`
      : target.kind === "room"
        ? `room:${target.roomId}`
        : target.kind === "device"
          ? `device:${target.deviceId}`
          : `ha-action:${item.id}`;
};

export function isActionBarDeviceNavigable(
  project: HomeProject,
  deviceId: string,
  _deviceModels?: DeviceModelRegistry,
): boolean {
  const device = project.sceneItems.find((item) => item.id === deviceId);
  return device?.kind === "device" && project.floors.some((floor) => floor.id === device.floorId);
}

export function validateActionBarTargets(
  project: HomeProject,
  issues: HomeProjectIssue[],
  deviceModels?: DeviceModelRegistry,
): void {
  if (!project.actionBar) return;
  const ids = new Set<string>();
  const targets = new Set<string>();
  const roomIds = new Set(
    project.floors.flatMap((floor) => roomsForFloor(floor).map((room) => room.id)),
  );
  project.actionBar.items.forEach((item, index) => {
    const path = `actionBar.items[${index}]`;
    if (ids.has(item.id))
      addProjectIssue(
        issues,
        "project.action-bar-id-duplicate",
        `${path}.id`,
        "Action bar item IDs must be unique.",
      );
    ids.add(item.id);
    const key = targetKey(item);
    if (targets.has(key))
      addProjectIssue(
        issues,
        "project.action-bar-target-duplicate",
        `${path}.target`,
        "This action is already in the bar.",
      );
    targets.add(key);
    if (item.target.kind === "room" && !roomIds.has(item.target.roomId)) {
      addProjectIssue(
        issues,
        "project.action-bar-room-missing",
        `${path}.target.roomId`,
        `Room “${item.target.roomId}” no longer exists. Replace or remove its action bar shortcut.`,
      );
    }
    if (
      item.target.kind === "device" &&
      !isActionBarDeviceNavigable(project, item.target.deviceId, deviceModels)
    ) {
      addProjectIssue(
        issues,
        "project.action-bar-device-missing",
        `${path}.target.deviceId`,
        `Device “${item.target.deviceId}” is missing or has no floor. Replace or remove its action bar shortcut.`,
      );
    }
  });
}
