import { defineFurnishingModel } from "@cabane/engine";
import { Stroller, STROLLER_SIZE } from "../presets/stroller";

export const strollerDefinition = defineFurnishingModel({
  component: Stroller,
  label: "Stroller / pushchair",
  category: "Household",
  defaultRoomType: "entryway",
  defaultColor: "#8c9d96",
  defaultSize: STROLLER_SIZE,
  bounds: { min: [-0.301, 0, -0.46], max: [0.301, 1.05, 0.46] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  placementEnvironment: "indoor-outdoor",
  outlineContact: true,
  complexity: { visibleMeshes: 36, triangles: 5000 },
});
