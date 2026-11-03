import { defineFurnishingModel } from "@cabane/engine";
import { RoundBandedRug } from "../presets/children-bedroom/round-banded-rug";
export const roundBandedRugDefinition = defineFurnishingModel({
  defaultColor: "#dec9bb",
  component: RoundBandedRug,
  label: "Round banded rug",
  category: "Children",
  defaultRoomType: "bedroom",
  defaultSize: [1.2, 0.01, 1.2],
  bounds: { min: [-0.6, 0, -0.6], max: [0.6, 0.01, 0.6] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 4, triangles: 600 },
});
