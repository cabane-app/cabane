import { defineFurnishingModel } from "@cabane/engine";
import { CordlessVacuum, CORDLESS_VACUUM_SIZE } from "../presets/cordless-vacuum";

export const cordlessVacuumDefinition = defineFurnishingModel({
  component: CordlessVacuum,
  label: "Cordless vacuum with wall dock",
  category: "Cleaning",
  defaultRoomType: "laundry",
  defaultSize: CORDLESS_VACUUM_SIZE,
  bounds: { min: [-0.125, 0, 0], max: [0.125, 1.256, 0.26] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "wall",
  outlineContact: false,
  complexity: { visibleMeshes: 24, triangles: 4500 },
});
