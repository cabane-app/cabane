import { defineDeviceModel } from "@cabane/engine";
import {
  GuardedPlatformFanModel,
  GUARDED_PLATFORM_FAN_SIZE,
} from "../presets/fans/guarded-platform-fan";
import { InlineDuctFanModel, INLINE_DUCT_FAN_SIZE } from "../presets/fans/inline-duct-fan";

const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };

export const guardedPlatformFanDefinition = defineDeviceModel({
  defaultRoomType: "living-room",
  component: GuardedPlatformFanModel,
  label: "Guarded fan",
  category: "Climate",
  defaultSize: GUARDED_PLATFORM_FAN_SIZE,
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  supportedDomains: ["fan"],
  mountKind: "surface",
  bounds: { min: [-0.07, 0, -0.07], max: [0.07, 0.03, 0.07] },
  outlineContact: false,
  interaction,
  complexity: { visibleMeshes: 20, triangles: 4_500 },
});

export const inlineDuctFanDefinition = defineDeviceModel({
  defaultRoomType: "living-room",
  component: InlineDuctFanModel,
  label: "Inline fan",
  category: "Climate",
  defaultSize: INLINE_DUCT_FAN_SIZE,
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  supportedDomains: ["fan"],
  mountKind: "surface",
  bounds: { min: [-0.07, 0, -0.07], max: [0.07, 0.3, 0.07] },
  outlineContact: false,
  interaction,
  complexity: { visibleMeshes: 12, triangles: 3_000 },
});
