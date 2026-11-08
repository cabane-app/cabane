import { defineFurnishingModel } from "@cabane/engine";
import { SingleWindowCurtain } from "./single-window-curtain";

export const singleWindowCurtainDefinition = defineFurnishingModel({
  defaultRoomType: "living-room",
  component: SingleWindowCurtain,
  label: "Curtains",
  defaultColor: "#d8c8ad",
  category: "Decor",
  variants: [
    { id: "left", label: "Single panel, gathered left" },
    { id: "right", label: "Single panel, gathered right" },
    { id: "linen-tiebacks", label: "Linen pair with tiebacks" },
  ],
  defaultSize: [1.2, 2.4, 0.12],
  bounds: { min: [-0.6, 0, 0], max: [0.6, 2.4, 0.12] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "wall",
  windowFit: {
    openingWidthRatio: 0.95,
    openingHeightRatio: 2.32 / 2.4,
    depthOffsetMeters: 0.003,
    openingTypes: ["window", "sliding-glass-door"],
  },
  outlineContact: true,
  complexity: { visibleMeshes: 9, triangles: 6000 },
});
