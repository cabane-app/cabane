import { defineFurnishingModel } from "@cabane/engine";
import { Carport, CARPORT_SIZE } from "../presets/outdoor/carport";
import {
  WroughtIronPergola,
  WROUGHT_IRON_PERGOLA_SIZE,
} from "../presets/outdoor/wrought-iron-pergola";

export const outdoorShelterFurnishingDefinitions = {
  carport: defineFurnishingModel({
    component: Carport,
    defaultColor: "#465257",
    label: "Carport",
    category: "Garden structures",
    defaultRoomType: "outdoor",
    defaultSize: CARPORT_SIZE,
    bounds: { min: [-1.8, 0, -2.8], max: [1.8, 3, 2.8] },
    variants: [
      { id: "default", label: "Modern flat roof" },
      { id: "timber", label: "Timber pitched roof" },
      { id: "solar", label: "Solar canopy" },
    ],
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    placementEnvironment: "outdoor",
    outlineContact: false,
    complexity: { visibleMeshes: 40, triangles: 30_000 },
  }),
  "wrought-iron-pergola": defineFurnishingModel({
    legacyOnly: true,
    component: WroughtIronPergola,
    label: "Wrought-iron pergola",
    category: "Garden structures",
    defaultRoomType: "outdoor",
    defaultSize: WROUGHT_IRON_PERGOLA_SIZE,
    bounds: { min: [-2, 0, -1.5], max: [2, 2.7, 1.5] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    placementEnvironment: "outdoor",
    outlineContact: false,
    complexity: { visibleMeshes: 14, triangles: 24_000 },
  }),
};
