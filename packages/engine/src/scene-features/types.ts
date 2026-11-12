import type { BuildingGeometry } from "../stairs/types";
import type { ComponentType } from "react";
import type { FloorSpec } from "../types";
import type { OpeningPositions } from "../opening-pose";

/** Scene-local inputs only. Features receive no Home Assistant runtime or credentials. */
export interface SceneFeatureProps {
  building: BuildingGeometry;
  floor: FloorSpec;
  elevation: number;
  view: "walk" | "orbit";
  openingPositions: OpeningPositions;
  /** Pause background work when the document is hidden or scene controls are blocked. */
  enabled: boolean;
  reducedMotion: boolean;
}

/** Optional host installation, independent from equipped walk tools and project data. */
export interface SceneFeatureDefinition {
  id: string;
  label: string;
  Scene: ComponentType<SceneFeatureProps>;
}
