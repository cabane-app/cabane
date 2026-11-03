import { defineDeviceModel } from "@cabane/engine";
import { ComputerFanModel, COMPUTER_FAN_SIZE } from "../presets/fans/computer-fan";
import { VentilationFanModel, VENTILATION_FAN_SIZE } from "../presets/fans/ventilation-fan";

const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };

export const computerFanDefinition = defineDeviceModel({
  defaultRoomType: "living-room",
  component: ComputerFanModel,
  label: "Computer fan",
  category: "Climate",
  defaultSize: COMPUTER_FAN_SIZE,
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  supportedDomains: ["fan"],
  mountKind: "surface",
  bounds: { min: [-0.07, 0, -0.07], max: [0.07, 0.03, 0.07] },
  outlineContact: false,
  interaction,
  complexity: { visibleMeshes: 20, triangles: 4_500 },
});

export const ventilationFanDefinition = defineDeviceModel({
  defaultRoomType: "living-room",
  component: VentilationFanModel,
  label: "Ventilation fan",
  category: "Climate",
  defaultSize: VENTILATION_FAN_SIZE,
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  supportedDomains: ["fan"],
  mountKind: "surface",
  bounds: { min: [-0.07, 0, -0.07], max: [0.07, 0.3, 0.07] },
  outlineContact: false,
  interaction,
  complexity: { visibleMeshes: 12, triangles: 3_000 },
});
