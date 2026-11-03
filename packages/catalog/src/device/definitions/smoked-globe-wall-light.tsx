import { defineDeviceModel } from "@cabane/engine";
import {
  SmokedGlobeWallLightModel,
  SMOKED_GLOBE_WALL_LIGHT_SIZE,
} from "../presets/lighting/smoked-globe-wall-light";

export const smokedGlobeWallLightDeviceDefinition = defineDeviceModel({
  component: SmokedGlobeWallLightModel,
  label: "Smoked globe wall light",
  category: "Lighting",
  defaultRoomType: "entryway",
  defaultSize: SMOKED_GLOBE_WALL_LIGHT_SIZE,
  bounds: { min: [-0.1, 0, 0], max: [0.1, 0.4, 0.26] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  supportedDomains: ["light"],
  mountKind: "wall",
  sceneLight: { position: [0, 0.2, 0.16], color: "#ffe0a3", maxIntensity: 1.35, distance: 2.4 },
  outlineContact: false,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 4, triangles: 1500 },
});
