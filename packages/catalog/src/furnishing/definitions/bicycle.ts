import { defineFurnishingModel } from "@cabane/engine";
import { Bicycle, BICYCLE_SIZE } from "../presets/bicycle";

export const bicycleDefinition = defineFurnishingModel({
  component: Bicycle,
  label: "Bicycle",
  category: "Vehicles",
  defaultRoomType: "outdoor",
  defaultSize: BICYCLE_SIZE,
  bounds: { min: [-0.32, 0, -0.9], max: [0.32, 1.1, 0.9] },
  resizePolicy: { kind: "uniform" },
  preferredPlacement: "absolute",
  placementEnvironment: "indoor-outdoor",
  outlineContact: true,
  variants: [
    { id: "e-bike", label: "E-bike" },
    { id: "mtb", label: "Mountain bike (MTB)" },
    { id: "gravel", label: "Gravel" },
  ],
  complexity: { visibleMeshes: 50, triangles: 4200 },
});
