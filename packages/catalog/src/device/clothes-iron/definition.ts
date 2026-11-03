import { defineDeviceModel } from "@cabane/engine";
import { ClothesIronModel, CLOTHES_IRON_SIZE } from "./clothes-iron";

export const clothesIronDefinition = defineDeviceModel({
  component: ClothesIronModel,
  label: "Clothes iron",
  category: "Appliances",
  defaultRoomType: "laundry",
  defaultSize: CLOTHES_IRON_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  supportedDomains: ["switch", "sensor", "binary_sensor"],
  mountKind: "surface",
  bounds: { min: [-0.06, 0, -0.16], max: [0.06, 0.144, 0.16] },
  outlineContact: true,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 15, triangles: 3500 },
});
