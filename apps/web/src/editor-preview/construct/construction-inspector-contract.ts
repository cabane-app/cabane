import type { RoofSettings } from "@cabane/engine";
import type { ConstructEditorController } from "./construct-controller-contract";
import type { FloorPaintingInspector } from "./floor-painting-contract";
export interface ConstructionInspectorProps {
  inert?: boolean;
  referencePlanControls?: import("react").ReactNode;
  planImportControls?: import("react").ReactNode;
  northControls?: import("react").ReactNode;
  terrainControls?: import("react").ReactNode;
  tutorialControls?: import("react").ReactNode;
  walkStartControls?: import("react").ReactNode;
  roof?: RoofSettings | undefined;
  onRoofChange?: (settings: RoofSettings) => void;
  editor: ConstructEditorController;
  floorPainting?: FloorPaintingInspector;
}
