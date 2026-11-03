import { defineFurnishingModel } from "@cabane/engine";
import {
  TuftedDiamondRug,
  TUFTED_DIAMOND_RUG_SIZE,
} from "../presets/living-room/tufted-diamond-rug";
export const tuftedDiamondRugDefinition = defineFurnishingModel({
  defaultColor: "#ddd7c8",
  component: TuftedDiamondRug,
  label: "Tufted diamond rug",
  category: "Decor",
  defaultRoomType: "living-room",
  defaultSize: TUFTED_DIAMOND_RUG_SIZE,
  bounds: { min: [-1.3, 0, -1], max: [1.3, 0.016, 1] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 57, triangles: 2500 },
});
