import { defineFurnishingModel } from "@cabane/engine";
import {
  KitchenHood,
  KITCHEN_HOOD_SIZE,
  KITCHEN_HOOD_VARIANTS,
} from "../presets/utility/kitchen-hood";

export const kitchenHoodDefinition = defineFurnishingModel({
  component: KitchenHood,
  label: "Kitchen hood",
  category: "Kitchen",
  defaultRoomType: "kitchen",
  defaultSize: KITCHEN_HOOD_SIZE,
  variants: KITCHEN_HOOD_VARIANTS,
  bounds: { min: [-0.3, 0, 0], max: [0.3, 0.7, 0.5] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  outlineContact: true,
  complexity: { visibleMeshes: 12, triangles: 1100 },
});
