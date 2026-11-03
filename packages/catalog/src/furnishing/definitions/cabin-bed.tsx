import { defineFurnishingModel } from "@cabane/engine";
import { CabinBed } from "../presets/children-bedroom/cabin-bed";

export const cabinBedDefinition = defineFurnishingModel({
  defaultColor: "#edc9c4",
  defaultRoomType: "bedroom",
  component: ({ size, color }) => (
    <group scale={[size[0] / 1.183, size[1] / 1.696, size[2] / 2.432]}>
      <CabinBed color={color} />
    </group>
  ),
  label: "Cabin bed",
  category: "Children",
  defaultSize: [1.183, 1.696, 2.432],
  bounds: { min: [-0.597, 0, -1.216], max: [0.586, 1.696, 1.216] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 50, triangles: 9_000 },
});
