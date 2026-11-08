import { defineFurnishingModel } from "@cabane/engine";
import {
  AtelierLibraryBookcase,
  ATELIER_LIBRARY_BOOKCASE_SIZE,
  AtelierLibraryCredenza,
  ATELIER_LIBRARY_CREDENZA_SIZE,
  AtelierLibraryBench,
  ATELIER_LIBRARY_BENCH_SIZE,
} from "./index";

export const atelierLibraryDefinitions = {
  "atelier-library-bookcase": defineFurnishingModel({
    component: AtelierLibraryBookcase,
    label: "Atelier oak library bookcase",
    category: "Storage",
    defaultRoomType: "living-room",
    defaultSize: ATELIER_LIBRARY_BOOKCASE_SIZE,
    bounds: { min: [-0.6, 0, -0.21], max: [0.6, 2.5, 0.21] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 48, triangles: 6000 },
  }),
  "atelier-library-credenza": defineFurnishingModel({
    component: AtelierLibraryCredenza,
    label: "Atelier stone-top library credenza",
    category: "Storage",
    defaultRoomType: "living-room",
    defaultSize: ATELIER_LIBRARY_CREDENZA_SIZE,
    bounds: { min: [-0.9, 0, -0.22], max: [0.9, 0.76, 0.22] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 14, triangles: 3000 },
  }),
  "atelier-library-bench": defineFurnishingModel({
    component: AtelierLibraryBench,
    label: "Atelier upholstered library bench",
    category: "Seating",
    defaultRoomType: "living-room",
    defaultSize: ATELIER_LIBRARY_BENCH_SIZE,
    bounds: { min: [-0.9, 0, -0.275], max: [0.9, 0.48, 0.275] },
    resizePolicy: { kind: "axes", axes: ["width", "height", "depth"] },
    preferredPlacement: "absolute",
    outlineContact: true,
    complexity: { visibleMeshes: 10, triangles: 3000 },
  }),
};
