import { defineFurnishingModel } from "@cabane/engine";
import { CatLitterTray, CAT_LITTER_TRAY_SIZE } from "../presets/cat-litter-tray";

export const catLitterTrayDefinition = defineFurnishingModel({
  component: CatLitterTray,
  label: "Cat litter tray",
  category: "Pets",
  defaultRoomType: "bathroom",
  defaultColor: "#9aaea7",
  defaultSize: CAT_LITTER_TRAY_SIZE,
  bounds: { min: [-0.23, 0, -0.29], max: [0.23, 0.18, 0.29] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 2, triangles: 1100 },
});
