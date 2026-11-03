import { defineFurnishingModel } from "@cabane/engine";
import { IndoorBin, INDOOR_BIN_SIZE } from "../presets/indoor-bin";

export const indoorBinDefinition = defineFurnishingModel({
  component: IndoorBin,
  label: "Indoor trash / recycling bin",
  category: "Household",
  defaultRoomType: "kitchen",
  defaultColor: "#a7b4aa",
  defaultSize: INDOOR_BIN_SIZE,
  bounds: { min: [-0.18, 0, -0.2], max: [0.18, 0.62, 0.2] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  variants: [
    { id: "default", label: "Kitchen recycling" },
    { id: "bathroom", label: "Bathroom pedal" },
    { id: "office", label: "Office wastebasket" },
  ],
  complexity: { visibleMeshes: 7, triangles: 3000 },
});
