import { defineFurnishingModel } from "@cabane/engine";
import { BronzeArmillary, BRONZE_ARMILLARY_SIZE } from "./bronze-armillary";
import { LoopSculpture, LOOP_SCULPTURE_SIZE } from "./loop-sculpture";
import { TravertineGardenBench, TRAVERTINE_GARDEN_BENCH_SIZE } from "./travertine-garden-bench";
import { CarvedStonePlanter, CARVED_STONE_PLANTER_SIZE } from "./carved-stone-planter";
import {
  TravertinePedestalTable,
  TRAVERTINE_PEDESTAL_TABLE_SIZE,
} from "./travertine-pedestal-table";

export const observatoryAccentDefinitions = {
  "bronze-armillary": defineFurnishingModel({
    component: BronzeArmillary,
    label: "Bronze armillary sphere",
    category: "Decor",
    defaultRoomType: "office",
    defaultSize: BRONZE_ARMILLARY_SIZE,
    bounds: { min: [-0.26, 0, -0.26], max: [0.26, 0.68, 0.26] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 7, triangles: 3000 },
  }),
  "loop-sculpture": defineFurnishingModel({
    component: LoopSculpture,
    label: "Bronze loop sculpture on plinth",
    category: "Decor",
    defaultRoomType: "living-room",
    defaultSize: LOOP_SCULPTURE_SIZE,
    bounds: { min: [-0.275, 0, -0.225], max: [0.275, 1.65, 0.225] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 3, triangles: 1800 },
  }),
  "travertine-garden-bench": defineFurnishingModel({
    component: TravertineGardenBench,
    label: "Travertine garden bench",
    category: "Seating",
    defaultRoomType: "outdoor",
    defaultSize: TRAVERTINE_GARDEN_BENCH_SIZE,
    bounds: { min: [-0.9, 0, -0.25], max: [0.9, 0.45, 0.25] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    placementEnvironment: "indoor-outdoor",
    outlineContact: false,
    complexity: { visibleMeshes: 3, triangles: 1200 },
  }),
  "carved-stone-planter": defineFurnishingModel({
    component: CarvedStonePlanter,
    label: "Carved limestone planter",
    category: "Garden",
    defaultRoomType: "outdoor",
    defaultSize: CARVED_STONE_PLANTER_SIZE,
    bounds: { min: [-0.32, 0, -0.32], max: [0.32, 0.72, 0.32] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    placementEnvironment: "indoor-outdoor",
    outlineContact: false,
    complexity: { visibleMeshes: 2, triangles: 800 },
  }),
  "travertine-pedestal-table": defineFurnishingModel({
    component: TravertinePedestalTable,
    label: "Travertine pedestal table",
    category: "Tables",
    defaultRoomType: "living-room",
    defaultSize: TRAVERTINE_PEDESTAL_TABLE_SIZE,
    bounds: { min: [-0.25, 0, -0.25], max: [0.25, 0.52, 0.25] },
    resizePolicy: { kind: "uniform" },
    preferredPlacement: "absolute",
    outlineContact: false,
    complexity: { visibleMeshes: 1, triangles: 800 },
  }),
};
