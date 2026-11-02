import { defineDeviceModel } from "@cabane/engine";
import {
  CompactWallTelevisionModel,
  COMPACT_WALL_TELEVISION_SIZE,
  WallTelevisionModel,
  WALL_TELEVISION_SIZE,
} from "../presets/media";
const interaction = { target: "device-dashboard" as const, tapTolerancePixels: 10 };
export const compactWallTelevisionDefinition = defineDeviceModel({
  component: CompactWallTelevisionModel,
  label: "Compact wall television",
  category: "Media",
  defaultRoomType: "living-room",
  defaultSize: COMPACT_WALL_TELEVISION_SIZE,
  bounds: { min: [-0.79, 0, 0], max: [0.79, 0.9, 0.07] },
  resizePolicy: { kind: "axes", axes: ["width", "height"] },
  preferredPlacement: "wall",
  supportedDomains: ["media_player", "switch"],
  mountKind: "wall",
  outlineContact: true,
  interaction,
  complexity: { visibleMeshes: 7, triangles: 160 },
});
export const wallTelevisionDefinition = defineDeviceModel({
  defaultRoomType: "living-room",
  component: WallTelevisionModel,
  label: "Wall television · 110 inch",
  category: "Media",
  defaultSize: WALL_TELEVISION_SIZE,
  resizePolicy: { kind: "fixed" },
  preferredPlacement: "wall",
  supportedDomains: ["media_player", "switch"],
  mountKind: "wall",
  bounds: { min: [-1.2, 0, 0], max: [1.2, 1.36, 0.07] },
  outlineContact: true,
  interaction,
  complexity: { visibleMeshes: 7, triangles: 160 },
});
