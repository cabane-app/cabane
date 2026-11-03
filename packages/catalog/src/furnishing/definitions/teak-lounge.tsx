import { defineFurnishingModel } from "@cabane/engine";
import {
  TeakLoungeSofa,
  TeakLoungeChair,
  TEAK_LOUNGE_SOFA_SIZE,
  TEAK_LOUNGE_CHAIR_SIZE,
} from "../presets/outdoor";
export const teakLoungeDefinitions = {
  "teak-lounge-sofa": defineFurnishingModel({
    defaultColor: "#e8ddc7",
    component: TeakLoungeSofa,
    label: "Teak lounge sofa",
    category: "Outdoor",
    defaultRoomType: "outdoor",
    defaultSize: TEAK_LOUNGE_SOFA_SIZE,
    bounds: { min: [-1.0, 0, -0.4], max: [1.0, 0.84, 0.4] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 44, triangles: 20000 },
    variants: [
      { id: "clay", label: "Ivory and terracotta" },
      { id: "sage", label: "Ivory and sage" },
    ],
  }),
  "teak-lounge-chair": defineFurnishingModel({
    defaultColor: "#e8ddc7",
    component: TeakLoungeChair,
    label: "Teak lounge chair",
    category: "Outdoor",
    defaultRoomType: "outdoor",
    defaultSize: TEAK_LOUNGE_CHAIR_SIZE,
    bounds: { min: [-0.4, 0, -0.4], max: [0.4, 0.84, 0.4] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 32, triangles: 13000 },
    variants: [
      { id: "clay", label: "Ivory and terracotta" },
      { id: "sage", label: "Ivory and sage" },
    ],
  }),
};
