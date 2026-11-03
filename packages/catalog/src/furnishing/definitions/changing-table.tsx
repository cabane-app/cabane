import { defineFurnishingModel } from "@cabane/engine";
import { ChangingTable } from "../presets/children-bedroom/changing-table";

export const changingTableDefinition = defineFurnishingModel({
  defaultColor: "#dfbbb7",
  defaultRoomType: "bedroom",
  component: ({ size, color }) => (
    <group scale={[size[0] / 0.81, size[1] / 0.947, size[2] / 0.497]}>
      <ChangingTable color={color} />
    </group>
  ),
  label: "Changing table",
  category: "Children",
  defaultSize: [0.81, 0.947, 0.497],
  bounds: { min: [-0.405, -0.003, -0.235], max: [0.405, 0.944, 0.262] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 28, triangles: 5_000 },
});
