import { defineFurnishingModel } from "@cabane/engine";
import { MediaWall } from "../presets/living-room/media-wall";

export const mediaWallDefinition = defineFurnishingModel({
  defaultRoomType: "living-room",
  component: ({ size }) => (
    <group rotation={[0, Math.PI, 0]} scale={[size[0] / 3.35, size[1] / 1.378, size[2] / 0.433]}>
      <MediaWall />
    </group>
  ),
  label: "Media wall",
  category: "Living room",
  defaultSize: [3.35, 1.378, 0.433],
  bounds: { min: [-1.155, 0, -0.215], max: [2.195, 1.378, 0.218] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  outlineContact: true,
  complexity: { visibleMeshes: 32, triangles: 8_200 },
});
