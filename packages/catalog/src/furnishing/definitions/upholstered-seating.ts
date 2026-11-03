import { defineFurnishingModel } from "@cabane/engine";
import {
  TwoSeatLoveseat,
  TWO_SEAT_LOVESEAT_SIZE,
  IndoorChaiseLongue,
  INDOOR_CHAISE_LONGUE_SIZE,
  ThreeSeatSofa,
  THREE_SEAT_SOFA_SIZE,
  UpholsteredArmchair,
  UPHOLSTERED_ARMCHAIR_SIZE,
  UpholsteredOttoman,
  UPHOLSTERED_OTTOMAN_SIZE,
} from "../presets/living-room";

export const twoSeatLoveseatDefinition = defineFurnishingModel({
  component: TwoSeatLoveseat,
  defaultColor: "#91a18b",
  label: "Two seat loveseat",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: TWO_SEAT_LOVESEAT_SIZE,
  bounds: { min: [-0.8, 0, -0.44], max: [0.8, 0.82, 0.44] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 12, triangles: 6000 },
});

export const indoorChaiseLongueDefinition = defineFurnishingModel({
  defaultColor: "#ba7960",
  component: IndoorChaiseLongue,
  label: "Indoor chaise longue",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: INDOOR_CHAISE_LONGUE_SIZE,
  bounds: { min: [-0.4, 0, -0.825], max: [0.4, 0.8, 0.825] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 7, triangles: 3500 },
});

export const threeSeatSofaDefinition = defineFurnishingModel({
  component: ThreeSeatSofa,
  label: "3-seat sofa",
  defaultColor: "#e2d5bf",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: THREE_SEAT_SOFA_SIZE,
  bounds: { min: [-1.1, 0, -0.47], max: [1.1, 0.84, 0.47] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 21, triangles: 10_000 },
});

export const upholsteredArmchairDefinition = defineFurnishingModel({
  defaultColor: "#dfd2bc",
  component: UpholsteredArmchair,
  label: "Upholstered armchair",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: UPHOLSTERED_ARMCHAIR_SIZE,
  bounds: { min: [-0.425, 0, -0.44], max: [0.425, 0.9, 0.44] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 10, triangles: 4_000 },
});

export const upholsteredOttomanDefinition = defineFurnishingModel({
  defaultColor: "#ded1ba",
  component: UpholsteredOttoman,
  label: "Upholstered ottoman",
  category: "Seating",
  defaultRoomType: "living-room",
  defaultSize: UPHOLSTERED_OTTOMAN_SIZE,
  bounds: { min: [-0.35, 0, -0.275], max: [0.35, 0.42, 0.275] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  complexity: { visibleMeshes: 7, triangles: 3_000 },
});
