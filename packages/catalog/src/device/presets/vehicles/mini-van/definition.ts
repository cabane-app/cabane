import { defineDeviceModel } from "@cabane/engine";
import { MiniVanModel, MINI_VAN_SIZE, MINI_VAN_DEFAULT_COLOR } from "./mini-van";

export const miniVanDefinition = defineDeviceModel({
  component: MiniVanModel,
  label: "Mini van",
  category: "Vehicles",
  defaultRoomType: "outdoor",
  placementEnvironment: "indoor-outdoor",
  defaultSize: MINI_VAN_SIZE,
  defaultColor: MINI_VAN_DEFAULT_COLOR,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  mountKind: "surface",
  supportedDomains: ["switch", "sensor", "binary_sensor"],
  bounds: { min: [-1.08, 0, -2.45], max: [1.08, 1.86, 2.45] },
  outlineContact: true,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 14, triangles: 30_000 },
});
