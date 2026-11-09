import { defineDeviceModel } from "@cabane/engine";
import {
  OutdoorWallLanternModel,
  OUTDOOR_WALL_LANTERN_SIZE,
} from "../presets/lighting/outdoor-wall-lantern";

export const outdoorWallLanternDefinition = defineDeviceModel({
  component: OutdoorWallLanternModel,
  label: "Outdoor wall lantern",
  category: "Lighting",
  defaultRoomType: "outdoor",
  defaultSize: OUTDOOR_WALL_LANTERN_SIZE,
  bounds: { min: [-0.15, 0, 0], max: [0.15, 0.65, 0.46] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "wall",
  supportedDomains: ["light"],
  mountKind: "wall",
  sceneLight: { position: [0, 0.29, 0.31], color: "#ffd28c", maxIntensity: 1.5, distance: 3 },
  outlineContact: false,
  interaction: { target: "device-dashboard", tapTolerancePixels: 10 },
  complexity: { visibleMeshes: 17, triangles: 4500 },
});
