import { defineFurnishingModel } from "@cabane/engine";
import {
  HexagonalSideTable,
  HEXAGONAL_SIDE_TABLE_SIZE,
} from "../presets/living-room/hexagonal-side-table";
export const hexagonalSideTableDefinition = defineFurnishingModel({
  component: HexagonalSideTable,
  label: "Hexagonal side table",
  category: "Tables",
  defaultRoomType: "living-room",
  defaultSize: HEXAGONAL_SIDE_TABLE_SIZE,
  bounds: { min: [-0.3, 0, -0.25980762115], max: [0.3, 0.43, 0.25980762115] },
  variants: [
    { id: "default", label: "White top · Oak body" },
    { id: "oak-top", label: "Oak top · White body" },
  ],
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 3, triangles: 1900 },
});
