import { defineDeviceModel } from "@cabane/engine";
import {
  CompactCarModel,
  COMPACT_CAR_SIZE,
  ElectricSedanModel,
  ELECTRIC_SEDAN_SIZE,
  PickupTruckModel,
  PICKUP_TRUCK_SIZE,
} from "../presets/vehicles";

const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };

export const compactCarDefinition = defineDeviceModel({
  component: CompactCarModel,
  label: "Compact European car",
  category: "Vehicles",
  defaultRoomType: "outdoor",
  placementEnvironment: "indoor-outdoor",
  defaultSize: COMPACT_CAR_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  mountKind: "surface",
  supportedDomains: ["sensor"],
  bounds: { min: [-0.97, 0, -2.0], max: [0.97, 1.5, 2.0] },
  outlineContact: true,
  interaction,
  complexity: { visibleMeshes: 14, triangles: 31_000 },
});

export const electricSedanDefinition = defineDeviceModel({
  component: ElectricSedanModel,
  label: "Tesla-like electric sedan",
  category: "Vehicles",
  defaultRoomType: "outdoor",
  placementEnvironment: "indoor-outdoor",
  defaultSize: ELECTRIC_SEDAN_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  mountKind: "surface",
  supportedDomains: ["sensor"],
  bounds: { min: [-1.04, 0, -2.35], max: [1.04, 1.45, 2.35] },
  outlineContact: true,
  interaction,
  complexity: { visibleMeshes: 15, triangles: 32_000 },
});

export const pickupTruckDefinition = defineDeviceModel({
  component: PickupTruckModel,
  label: "Pickup truck",
  category: "Vehicles",
  defaultRoomType: "outdoor",
  placementEnvironment: "indoor-outdoor",
  defaultSize: PICKUP_TRUCK_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  mountKind: "surface",
  supportedDomains: ["sensor"],
  bounds: { min: [-1.12, 0, -2.7], max: [1.12, 1.86, 2.7] },
  outlineContact: true,
  interaction,
  complexity: { visibleMeshes: 16, triangles: 34_000 },
});
