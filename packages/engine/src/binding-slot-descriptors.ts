import { outsideRoomDevices } from "./outside-room-devices";
import { pointInsidePolygon } from "./geometry";

import type { BindingSlotDescriptor, FloorSpec, HomeBindingManifest, OpeningSpec } from "./types";

const openingRoomIds = (
  floor: Pick<FloorSpec, "rooms" | "walls" | "coordinates">,
  opening: OpeningSpec,
) => {
  const wall = floor.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return [];
  const dx = wall.to[0] - wall.from[0];
  const dy = wall.to[1] - wall.from[1];
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return [];
  const progress = (opening.offsetFromWallStartPlanUnits + opening.widthPlanUnits / 2) / length;
  const midpoint = [wall.from[0] + dx * progress, wall.from[1] + dy * progress] as const;
  const normal = [-dy / length, dx / length] as const;
  const distances = [
    (wall.thicknessMeters / 2 + 0.04) / floor.coordinates.metersPerPlanUnit,
    0.32 / floor.coordinates.metersPerPlanUnit,
  ];
  return floor.rooms
    .filter((room) =>
      distances.some(
        (distance) =>
          pointInsidePolygon(
            [midpoint[0] + normal[0] * distance, midpoint[1] + normal[1] * distance],
            room.polygon,
          ) ||
          pointInsidePolygon(
            [midpoint[0] - normal[0] * distance, midpoint[1] - normal[1] * distance],
            room.polygon,
          ),
      ),
    )
    .map((room) => room.id);
};

export const collectBindingSlots = (
  manifest: HomeBindingManifest,
): readonly BindingSlotDescriptor[] => {
  const descriptors: BindingSlotDescriptor[] = [];
  for (const floor of manifest.floors) {
    for (const room of floor.rooms) {
      for (const spec of room.dashboardSlots) {
        descriptors.push({ slotId: spec.id, kind: "dashboard", roomIds: [room.id], spec });
      }
      for (const device of room.devices) {
        for (const spec of device.entitySlots) {
          descriptors.push({
            slotId: spec.id,
            kind: "device",
            roomIds: [room.id],
            deviceSlotId: device.id,
            deviceModel: device.model,
            spec,
          });
        }
      }
    }
    const outside = outsideRoomDevices(manifest, floor.id);
    for (const spec of outside?.dashboardSlots ?? []) {
      descriptors.push({ slotId: spec.id, kind: "dashboard", roomIds: [], spec });
    }
    for (const device of outside?.devices ?? []) {
      for (const spec of device.entitySlots)
        descriptors.push({
          slotId: spec.id,
          kind: "device",
          roomIds: [],
          deviceSlotId: device.id,
          deviceModel: device.model,
          spec,
        });
    }
    for (const opening of floor.openings) {
      if (opening.coverSlot)
        descriptors.push({
          slotId: opening.coverSlot.id,
          kind: "opening-cover",
          openingId: opening.id,
          roomIds: openingRoomIds(floor, opening),
          spec: {
            id: opening.coverSlot.id,
            compatibleDomains: ["cover"],
            compatibleDeviceClasses: ["garage"],
            required: false,
            autoMap: opening.coverSlot.autoMap,
            deviceRole: "primary",
            presentation: {
              label: `Garage door · ${opening.name || opening.id.replaceAll("-", " ")}`,
              dashboardRole: "primary",
            },
          },
        });
      if (!opening.contactSlot) continue;
      descriptors.push({
        slotId: opening.contactSlot.id,
        kind: "opening-contact",
        roomIds: openingRoomIds(floor, opening),
        openingId: opening.id,
        spec: {
          id: opening.contactSlot.id,
          compatibleDomains: ["binary_sensor"],
          compatibleDeviceClasses: opening.contactSlot.compatibleDeviceClasses,
          required: false,
          autoMap: opening.contactSlot.autoMap,
          deviceRole: "primary",
          presentation: {
            label: `${opening.kind === "door" ? "Door" : "Window"} · ${opening.name || opening.id.replaceAll("-", " ")}`,
            dashboardRole: "diagnostic",
          },
        },
      });
    }
  }
  return descriptors;
};
