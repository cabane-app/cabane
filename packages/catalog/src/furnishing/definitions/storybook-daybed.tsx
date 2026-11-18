import { defineFurnishingModel } from "@cabane/engine";
import { StorybookDaybed } from "../presets/children-bedroom/storybook-daybed";

const size = [1.183, 1.696, 2.432] as const;

export const storybookDaybedDefinition = defineFurnishingModel({
  defaultColor: "#edc9c4",
  defaultRoomType: "bedroom",
  component: ({ size: dimensions, color }) => (
    <group scale={[dimensions[0] / size[0], dimensions[1] / size[1], dimensions[2] / size[2]]}>
      <StorybookDaybed color={color} />
    </group>
  ),
  label: "Storybook daybed",
  category: "Children",
  defaultSize: size,
  bounds: { min: [-0.597, 0, -1.216], max: [0.586, 1.696, 1.216] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 26, triangles: 8_400 },
});
