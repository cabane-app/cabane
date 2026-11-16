import { defineFurnishingModel } from "@cabane/engine";
import { BookRow, BOOK_ROW_SIZE } from "../presets/living-room/book-row";
export const bookRowDefinition = defineFurnishingModel({
  component: BookRow,
  label: "Book row",
  category: "Decor",
  defaultRoomType: "living-room",
  defaultSize: BOOK_ROW_SIZE,
  bounds: { min: [-0.2, 0, -0.09], max: [0.2, 0.28, 0.09] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 7, triangles: 1300 },
});
