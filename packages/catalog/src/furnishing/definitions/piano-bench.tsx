import { defineFurnishingModel } from "@cabane/engine";
import { PianoBench } from "../presets/children-bedroom/piano-bench";
export const pianoBenchDefinition = defineFurnishingModel({
  defaultColor: "#292b2c",
  component: PianoBench,
  label: "Piano bench",
  category: "Children",
  defaultRoomType: "bedroom",
  defaultSize: [0.6, 0.48, 0.32],
  bounds: { min: [-0.3, 0, -0.16], max: [0.3, 0.48, 0.16] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 5, triangles: 2000 },
});
