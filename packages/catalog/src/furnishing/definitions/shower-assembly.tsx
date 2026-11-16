import { defineFurnishingModel } from "@cabane/engine";
import { ShowerAssembly, SHOWER_ASSEMBLY_SIZE } from "../presets/bathroom/shower-assembly";

export const showerAssemblyDefinition = defineFurnishingModel({
  defaultRoomType: "bathroom",
  component: ShowerAssembly,
  label: "Shower assembly",
  category: "Bathroom",
  defaultSize: SHOWER_ASSEMBLY_SIZE,
  bounds: { min: [-1, 0, -0.445], max: [1.018, 2.3, 0.463] },
  resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
  preferredPlacement: "absolute",
  outlineContact: false,
  complexity: { visibleMeshes: 22, triangles: 2850 },
});
