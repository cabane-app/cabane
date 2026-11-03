import { defineFurnishingModel } from "@cabane/engine";
import { BabyHighChair, BABY_HIGH_CHAIR_SIZE } from "../presets/baby-high-chair";

export const babyHighChairDefinition = defineFurnishingModel({
  component: BabyHighChair,
  label: "Baby high chair",
  variants: [
    { id: "default", label: "Stokke Tripp Trapp style" },
    { id: "ikea-antilop", label: "IKEA ANTILOP" },
  ],
  category: "Seating",
  defaultRoomType: "dining-room",
  defaultSize: BABY_HIGH_CHAIR_SIZE,
  bounds: { min: [-0.28, 0, -0.3], max: [0.28, 0.9, 0.3] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 16, triangles: 6000 },
});
