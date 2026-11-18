import { defineDeviceModel } from "@cabane/engine";
import { TerracottaPendantModel } from "../presets/lighting";
const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };
export const terracottaPendantDefinition = defineDeviceModel({
  defaultRoomType: "dining-room",
  component: TerracottaPendantModel,
  label: "Terracotta pendant",
  category: "Lighting",
  defaultSize: [0.66, 0.64, 0.66],
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "ceiling",
  supportedDomains: ["light"],
  mountKind: "surface",
  bounds: { min: [-0.33, 0, -0.33], max: [0.33, 0.64, 0.33] },
  outlineContact: false,
  sceneLight: {
    position: [0, 0.02, 0],
    color: "#ffd79a",
    maxIntensity: 5,
    distance: 5,
  },
  interaction,
  complexity: { visibleMeshes: 11, triangles: 4_450 },
});
