import { defineDeviceModel } from "@cabane/engine";
import { FireplaceModel, FIREPLACE_SIZE } from "./fireplace";

export const fireplaceDefinition = defineDeviceModel({
  component: FireplaceModel,
  label: "Fireplace",
  category: "Climate",
  defaultRoomType: "living-room",
  defaultSize: FIREPLACE_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "wall",
  supportedDomains: ["switch", "sensor", "binary_sensor", "light", "climate"],
  mountKind: "surface",
  bounds: { min: [-0.7, 0, 0], max: [0.7, 1.2, 0.5] },
  outlineContact: true,
  sceneLight: {
    position: [0, 0.32, 0.26],
    color: "#ffaf58",
    maxIntensity: 0.6,
    distance: 2.5,
  },
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 12, triangles: 2400 },
});
