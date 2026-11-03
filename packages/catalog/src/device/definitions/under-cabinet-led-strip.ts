import { DEFAULT_STRIP_MAX_SPACING_METERS, defineDeviceModel } from "@cabane/engine";
import {
  UnderCabinetLedStripModel,
  UNDER_CABINET_LED_STRIP_SIZE,
} from "../presets/lighting/under-cabinet-led-strip";
const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };
export const underCabinetLedStripDefinition = defineDeviceModel({
  component: UnderCabinetLedStripModel,
  label: "Under-cabinet LED strip",
  category: "Lighting",
  defaultRoomType: "kitchen",
  defaultSize: UNDER_CABINET_LED_STRIP_SIZE,
  bounds: { min: [-0.5, 0, -0.0125], max: [0.5, 0.015, 0.0125] },
  resizePolicy: { kind: "axes", axes: ["width"] },
  preferredPlacement: "absolute",
  supportedDomains: ["light"],
  mountKind: "surface",
  outlineContact: false,
  lighting: {
    position: [0, 0.002, 0],
    color: "#ffd99b",
    maxIntensity: 3,
    distance: 2.5,
    sources: [
      {
        kind: "strip",
        start: [-0.492, 0.002, 0],
        end: [0.492, 0.002, 0],
        samples: 2,
        maxSpacingMeters: DEFAULT_STRIP_MAX_SPACING_METERS,
      },
    ],
  },
  interaction,
  complexity: { visibleMeshes: 2, triangles: 24 },
});
