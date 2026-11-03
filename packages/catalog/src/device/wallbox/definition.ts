import { defineDeviceModel } from "@cabane/engine";
import { WallboxModel, WALLBOX_SIZE } from "./wallbox";

export const wallboxDefinition = defineDeviceModel({
  component: WallboxModel,
  label: "Wallbox EV charger",
  category: "Utilities",
  defaultRoomType: "outdoor",
  placementEnvironment: "indoor-outdoor",
  defaultSize: WALLBOX_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "wall",
  supportedDomains: ["switch", "sensor", "binary_sensor"],
  mountKind: "wall",
  bounds: { min: [-0.15, 0, 0], max: [0.15, 0.8, 0.2225] },
  outlineContact: true,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 12, triangles: 6_600 },
});
