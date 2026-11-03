import { defineDeviceModel } from "@cabane/engine";
import { Printer3DModel, PRINTER_3D_SIZE } from "./printer-3d";

export const printer3dDefinition = defineDeviceModel({
  component: Printer3DModel,
  label: "3D printer",
  category: "Appliances",
  defaultRoomType: "office",
  defaultSize: PRINTER_3D_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  supportedDomains: ["switch", "sensor", "binary_sensor"],
  mountKind: "surface",
  bounds: { min: [-0.24, 0, -0.24], max: [0.24, 0.6, 0.24] },
  outlineContact: true,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 32, triangles: 7_600 },
});
