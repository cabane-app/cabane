import { RATTAN_BELL_BULB_POSITION } from "../presets/lighting/rattan-bell-pendant/bulb-position";
import { defineDeviceModel } from "@cabane/engine";
import {
  RattanBellPendantModel,
  RATTAN_BELL_PENDANT_SIZE,
} from "../presets/lighting/rattan-bell-pendant";

export const rattanBellPendantDeviceDefinition = defineDeviceModel({
  component: RattanBellPendantModel,
  label: "Rattan bell pendant",
  category: "Lighting",
  defaultRoomType: "dining-room",
  defaultSize: RATTAN_BELL_PENDANT_SIZE,
  bounds: { min: [-0.25, 0, -0.25], max: [0.25, 1.2, 0.25] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "ceiling",
  supportedDomains: ["light"],
  mountKind: "surface",
  outlineContact: true,
  sceneLight: {
    position: RATTAN_BELL_BULB_POSITION,
    color: "#ffe1a3",
    maxIntensity: 0.45,
    distance: 3,
  },
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 10, triangles: 21_500 },
});
