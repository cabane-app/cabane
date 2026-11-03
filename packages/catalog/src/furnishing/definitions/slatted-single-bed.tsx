import { defineFurnishingModel } from "@cabane/engine";
import { SlattedSingleBed } from "../presets/children-bedroom/slatted-single-bed";
export const slattedSingleBedDefinition = defineFurnishingModel({
  defaultColor: "#e2c9ce",
  component: SlattedSingleBed,
  label: "Slatted single bed",
  category: "Children",
  defaultRoomType: "bedroom",
  defaultSize: [0.98, 0.73, 2.08],
  bounds: { min: [-0.49, 0, -1.04], max: [0.49, 0.73, 1.04] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 13, triangles: 5200 },
});
