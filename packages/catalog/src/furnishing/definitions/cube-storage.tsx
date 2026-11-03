import { defineFurnishingModel } from "@cabane/engine";
import { CubeStorage } from "../presets/children-bedroom/cube-storage";

export const cubeStorageDefinition = defineFurnishingModel({
  defaultColor: "#a95f59",
  defaultRoomType: "bedroom",
  component: ({ size, color }) => (
    <group scale={[size[0] / 0.85, size[1] / 1.202, size[2] / 0.412]}>
      <CubeStorage color={color} />
    </group>
  ),
  label: "Cube storage",
  category: "Children",
  defaultSize: [0.85, 1.202, 0.412],
  bounds: { min: [-0.425, 0, -0.17], max: [0.425, 1.202, 0.242] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 24, triangles: 4_500 },
});
