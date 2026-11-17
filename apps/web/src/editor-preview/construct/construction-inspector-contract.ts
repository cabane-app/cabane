import type { ConstructEditorController } from "./construct-controller-contract";
import type { FloorPaintingInspector } from "./floor-painting-contract";
export interface ConstructionInspectorProps {
  inert?: boolean;
  editor: ConstructEditorController;
  floorPainting?: FloorPaintingInspector;
}
