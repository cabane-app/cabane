import { defineFurnishingModel } from "@cabane/engine";
import { CustomDiningSet } from "../presets/dining-room/photo-dining-set/dining-set";

export const diningSetDefinition = defineFurnishingModel({
  defaultColor: "#b58e56",
  defaultRoomType: "dining-room",
  component: ({ size, color }) => (
    <group scale={[size[0] / 1.785, size[1] / 1.12, size[2] / 1.785]}>
      <CustomDiningSet footprintScale={0.88} color={color} />
    </group>
  ),
  label: "Dining set",
  category: "Living room",
  defaultSize: [1.785, 1.12, 1.785],
  bounds: { min: [-0.8925, 0, -0.8925], max: [0.8925, 1.12, 0.8925] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 26, triangles: 65_000 },
});
