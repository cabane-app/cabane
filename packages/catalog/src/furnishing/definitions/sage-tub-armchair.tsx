import { defineFurnishingModel } from "@cabane/engine";
import { SageTubArmchair, SAGE_TUB_ARMCHAIR_SIZE } from "../presets/living-room/sage-tub-armchair";
export const sageTubArmchairDefinition = defineFurnishingModel({
  defaultColor: "#819b8d",
  component: SageTubArmchair,
  label: "Sage tub armchair",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: SAGE_TUB_ARMCHAIR_SIZE,
  bounds: { min: [-0.39, 0, -0.4], max: [0.39, 0.86, 0.4] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 9, triangles: 2300 },
});
