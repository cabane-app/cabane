import { defineDeviceModel } from "@cabane/engine";
import { AdjustableDeskLampModel, ADJUSTABLE_DESK_LAMP_SIZE } from "./model";

export const adjustableDeskLampDefinition = defineDeviceModel({
  component: AdjustableDeskLampModel,
  label: "Adjustable desk lamp",
  category: "Lighting",
  defaultRoomType: "office",
  defaultSize: ADJUSTABLE_DESK_LAMP_SIZE,
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  supportedDomains: ["light"],
  mountKind: "surface",
  bounds: { min: [-0.11, 0, -0.281583], max: [0.11, 0.713423, 0.281583] },
  outlineContact: false,
  sceneLight: { position: [0, 0.5, 0.193417], color: "#ffe2a4", maxIntensity: 1.8, distance: 2.5 },
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 33, triangles: 3300 },
});
