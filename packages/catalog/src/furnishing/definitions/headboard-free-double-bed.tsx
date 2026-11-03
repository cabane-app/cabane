import { defineFurnishingModel } from "@cabane/engine";
import { HeadboardFreeDoubleBed } from "../presets/bedroom/headboard-free-double-bed";
export const headboardFreeDoubleBedDefinition = defineFurnishingModel({
  defaultColor: "#ded9cd",
  component: HeadboardFreeDoubleBed,
  label: "Headboard free double bed",
  category: "Bedroom",
  defaultRoomType: "bedroom",
  defaultSize: [1.64, 0.66, 2.04],
  bounds: { min: [-0.82, 0, -1.02], max: [0.82, 0.66, 1.02] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 9, triangles: 2300 },
});
