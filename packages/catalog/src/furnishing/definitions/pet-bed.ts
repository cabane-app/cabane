import { defineFurnishingModel } from "@cabane/engine";
import { PetBed, PET_BED_SIZE } from "../presets/pet-bed";

export const petBedDefinition = defineFurnishingModel({
  component: PetBed,
  label: "Pet bed",
  category: "Pets",
  defaultRoomType: "living-room",
  defaultColor: "#f3efe6",
  defaultSize: PET_BED_SIZE,
  bounds: { min: [-0.4, 0, -0.3], max: [0.4, 0.24, 0.3] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: true,
  variants: [
    { id: "default", label: "White fluffy" },
    { id: "padded-fabric", label: "Padded fabric" },
  ],
  complexity: { visibleMeshes: 4, triangles: 4300 },
});
