import { defineFurnishingModel } from "@cabane/engine";
import { CompactToilet } from "../presets/bathroom/compact-toilet";

export const compactToiletDefinition = defineFurnishingModel({
  defaultRoomType: "bathroom",
  component: ({ size }) => (
    <group scale={[size[0] / 0.39, size[1] / 0.724, size[2] / 0.6]}>
      <CompactToilet />
    </group>
  ),
  label: "Compact toilet",
  category: "Primary suite",
  defaultSize: [0.39, 0.724, 0.6],
  bounds: { min: [-0.195, 0.02, -0.3], max: [0.195, 0.744, 0.3] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 10, triangles: 3400 },
});
