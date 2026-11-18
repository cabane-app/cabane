import { defineFurnishingModel } from "@cabane/engine";
import { TransparentBathScreen } from "../presets/bathroom/transparent-bath-screen";

export const bathScreenDefinition = defineFurnishingModel({
  defaultRoomType: "bathroom",
  component: ({ size }) => (
    <group scale={[size[0] / 0.933, size[1] / 1.42, size[2] / 0.04]}>
      <TransparentBathScreen />
    </group>
  ),
  label: "Bath screen",
  category: "Bathroom",
  defaultSize: [0.933, 1.42, 0.04],
  bounds: { min: [-0.46, 0.54, -0.028], max: [0.473, 1.96, 0.012] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 3, triangles: 116 },
});
