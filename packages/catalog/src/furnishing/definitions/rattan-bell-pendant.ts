import { defineFurnishingModel } from "@cabane/engine";
import { RattanBellPendant, RATTAN_BELL_PENDANT_SIZE } from "../presets/rattan-bell-pendant";

export const rattanBellPendantDefinition = defineFurnishingModel({
  legacyOnly: true,
  component: RattanBellPendant,
  label: "Rattan bell pendant",
  category: "Lighting",
  defaultRoomType: "dining-room",
  defaultSize: RATTAN_BELL_PENDANT_SIZE,
  bounds: { min: [-0.25, 0, -0.25], max: [0.25, 1.2, 0.25] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "ceiling",
  outlineContact: true,
  complexity: { visibleMeshes: 10, triangles: 21_500 },
});
