import { defineFurnishingModel } from "@cabane/engine";
import { RingCeramicVase, RING_CERAMIC_VASE_SIZE } from "../presets/decor/ring-ceramic-vase";
export const ringCeramicVaseDefinition = defineFurnishingModel({
  component: RingCeramicVase,
  label: "Ring ceramic vase",
  category: "Decor",
  defaultRoomType: "living-room",
  defaultSize: RING_CERAMIC_VASE_SIZE,
  bounds: { min: [-0.09, 0, -0.03], max: [0.09, 0.3, 0.03] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 15, triangles: 3000 },
});
