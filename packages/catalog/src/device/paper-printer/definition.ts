import { defineDeviceModel } from "@cabane/engine";
import { PaperPrinterModel, PAPER_PRINTER_SIZE } from "./paper-printer";

export const paperPrinterDefinition = defineDeviceModel({
  component: PaperPrinterModel,
  label: "Paper printer",
  category: "Electronics",
  defaultRoomType: "office",
  defaultSize: PAPER_PRINTER_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "absolute",
  supportedDomains: ["switch", "sensor", "binary_sensor"],
  mountKind: "surface",
  bounds: { min: [-0.22, 0, -0.21], max: [0.22, 0.25, 0.21] },
  outlineContact: true,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 18, triangles: 4500 },
});
