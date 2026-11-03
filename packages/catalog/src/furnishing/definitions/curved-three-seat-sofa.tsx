import { defineFurnishingModel } from "@cabane/engine";
import {
  CurvedThreeSeatSofa,
  CURVED_THREE_SEAT_SOFA_SIZE,
} from "../presets/living-room/curved-three-seat-sofa";
export const curvedThreeSeatSofaDefinition = defineFurnishingModel({
  defaultColor: "#b4b5b0",
  component: CurvedThreeSeatSofa,
  label: "Curved three seat sofa",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: CURVED_THREE_SEAT_SOFA_SIZE,
  bounds: { min: [-1.3, 0, -0.55], max: [1.3, 0.88, 0.55] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 11, triangles: 3800 },
});
