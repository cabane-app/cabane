import { defineFurnishingModel } from "@cabane/engine";
import {
  Countertop,
  COUNTERTOP_SIZE,
  CornerCountertop,
  CORNER_COUNTERTOP_SIZE,
} from "../presets/kitchen";
import { COUNTERTOP_FINISH_VARIANTS } from "../presets/kitchen/countertop-finish";

export const countertopDefinitions = {
  countertop: defineFurnishingModel({
    component: Countertop,
    label: "Countertop",
    category: "Worktops",
    defaultRoomType: "kitchen",
    defaultSize: COUNTERTOP_SIZE,
    bounds: { min: [-0.9, 0, -0.315], max: [0.9, 0.04, 0.315] },
    variants: COUNTERTOP_FINISH_VARIANTS,
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 3, triangles: 1600 },
  }),
  "corner-countertop": defineFurnishingModel({
    component: CornerCountertop,
    label: "Corner countertop",
    category: "Worktops",
    defaultRoomType: "kitchen",
    defaultSize: CORNER_COUNTERTOP_SIZE,
    bounds: { min: [-0.63, 0, -0.63], max: [0.63, 0.04, 0.63] },
    variants: COUNTERTOP_FINISH_VARIANTS,
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 3, triangles: 1600 },
  }),
};
