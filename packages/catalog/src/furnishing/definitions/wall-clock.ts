import { defineFurnishingModel } from "@cabane/engine";
import { WallClock, WALL_CLOCK_SIZE } from "../presets/wall-clock";

export const wallClockDefinition = defineFurnishingModel({
  component: WallClock,
  label: "Wall clock",
  category: "Decor",
  defaultRoomType: "living-room",
  defaultSize: WALL_CLOCK_SIZE,
  bounds: { min: [-0.15, 0, 0], max: [0.15, 0.3, 0.045] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "wall",
  outlineContact: true,
  complexity: { visibleMeshes: 17, triangles: 1_500 },
});
