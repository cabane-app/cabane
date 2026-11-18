import { defineFurnishingModel } from "@cabane/engine";
import { RoundWallDisplay } from "../presets/children-bedroom/round-wall-display";

export const roundWallDisplayDefinition = defineFurnishingModel({
  defaultRoomType: "bedroom",
  component: ({ size }) => (
    <group scale={[size[0] / 0.77, size[1] / 0.77, size[2] / 0.23]}>
      <RoundWallDisplay />
    </group>
  ),
  label: "Round wall display",
  category: "Children",
  defaultSize: [0.77, 0.77, 0.23],
  bounds: { min: [-0.385, -0.385, -0.055], max: [0.385, 0.385, 0.175] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  outlineContact: true,
  complexity: { visibleMeshes: 6, triangles: 3_250 },
});
