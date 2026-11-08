import { defineFurnishingModel } from "@cabane/engine";
import {
  OakStoneDrawerCabinet,
  OAK_STONE_DRAWER_CABINET_SIZE,
  OakStoneSinkCabinet,
  OAK_STONE_SINK_CABINET_SIZE,
  OakAppliancePantry,
  OAK_APPLIANCE_PANTRY_SIZE,
  OakStoneKitchenIsland,
  OAK_STONE_KITCHEN_ISLAND_SIZE,
} from "./index";

const kitchen = {
  category: "Kitchen",
  defaultRoomType: "kitchen",
  preferredPlacement: "absolute",
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  outlineContact: false,
} as const;
export const oakStoneKitchenDefinitions = {
  "oak-stone-drawer-cabinet": defineFurnishingModel({
    ...kitchen,
    component: OakStoneDrawerCabinet,
    label: "Oak & stone drawer cabinet",
    defaultSize: OAK_STONE_DRAWER_CABINET_SIZE,
    bounds: { min: [-0.6, 0, -0.33], max: [0.6, 0.92, 0.33] },
    variants: [
      { id: "default", label: "Preparation drawers" },
      { id: "induction", label: "Induction cooktop" },
    ],
    complexity: { visibleMeshes: 17, triangles: 2400 },
  }),
  "oak-stone-sink-cabinet": defineFurnishingModel({
    ...kitchen,
    component: OakStoneSinkCabinet,
    label: "Oak & stone sink cabinet",
    defaultSize: OAK_STONE_SINK_CABINET_SIZE,
    bounds: { min: [-0.6, 0, -0.33], max: [0.6, 1.22, 0.33] },
    complexity: { visibleMeshes: 23, triangles: 1400 },
  }),
  "oak-appliance-pantry": defineFurnishingModel({
    ...kitchen,
    component: OakAppliancePantry,
    label: "Oak appliance pantry",
    defaultSize: OAK_APPLIANCE_PANTRY_SIZE,
    bounds: { min: [-0.4, 0, -0.33], max: [0.4, 2.3, 0.33] },
    complexity: { visibleMeshes: 18, triangles: 2000 },
  }),
  "oak-stone-kitchen-island": defineFurnishingModel({
    ...kitchen,
    component: OakStoneKitchenIsland,
    label: "Oak & stone waterfall island",
    defaultSize: OAK_STONE_KITCHEN_ISLAND_SIZE,
    bounds: { min: [-1.1, 0, -0.5], max: [1.1, 0.94, 0.5] },
    complexity: { visibleMeshes: 30, triangles: 3800 },
  }),
};
