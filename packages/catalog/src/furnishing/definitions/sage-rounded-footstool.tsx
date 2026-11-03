import { defineFurnishingModel } from "@cabane/engine";
import {
  SageRoundedFootstool,
  SAGE_ROUNDED_FOOTSTOOL_SIZE,
} from "../presets/living-room/sage-rounded-footstool";
export const sageRoundedFootstoolDefinition = defineFurnishingModel({
  defaultColor: "#819b8d",
  component: SageRoundedFootstool,
  label: "Sage rounded footstool",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: SAGE_ROUNDED_FOOTSTOOL_SIZE,
  bounds: { min: [-0.24, 0, -0.23], max: [0.24, 0.45, 0.23] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 5, triangles: 500 },
});
