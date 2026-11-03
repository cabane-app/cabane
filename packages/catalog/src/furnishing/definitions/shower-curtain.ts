import { defineFurnishingModel } from "@cabane/engine";
import { ShowerCurtain, SHOWER_CURTAIN_SIZE } from "../presets/shower-curtain";

export const showerCurtainDefinition = defineFurnishingModel({
  component: ShowerCurtain,
  label: "Shower curtain with rail",
  category: "Bathroom",
  defaultRoomType: "bathroom",
  defaultColor: "#dddcd0",
  defaultSize: SHOWER_CURTAIN_SIZE,
  bounds: { min: [-0.9, 0, -0.06], max: [0.9, 2, 0.06] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 17, triangles: 3500 },
});
