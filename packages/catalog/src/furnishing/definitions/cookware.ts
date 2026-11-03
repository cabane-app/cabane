import { defineFurnishingModel } from "@cabane/engine";
import { FryingPan, FRYING_PAN_SIZE, Saucepan, SAUCEPAN_SIZE } from "../presets/cookware";

export const cookwareDefinitions = {
  saucepan: defineFurnishingModel({
    component: Saucepan,
    label: "Saucepan",
    category: "Kitchen",
    defaultRoomType: "kitchen",
    defaultSize: SAUCEPAN_SIZE,
    bounds: { min: [-0.18, 0, -0.1], max: [0.18, 0.115, 0.1] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 3, triangles: 1500 },
  }),
  "frying-pan": defineFurnishingModel({
    component: FryingPan,
    label: "Frying pan",
    category: "Kitchen",
    defaultRoomType: "kitchen",
    defaultSize: FRYING_PAN_SIZE,
    bounds: { min: [-0.23, 0, -0.14], max: [0.23, 0.055, 0.14] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 3, triangles: 1500 },
  }),
};
