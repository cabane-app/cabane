export interface RoofSettings {
  /** Ridge axis in the building plan, or no gable rise for flat roofs. */
  direction: "left-right" | "front-back" | "flat";
  color: string;
  /** Thin roof trim and underside only; wall infill inherits exterior finishes. */
  edgeColor: string;
}

export const DEFAULT_ROOF_SETTINGS: Readonly<RoofSettings> = Object.freeze({
  direction: "left-right",
  color: "#aa6250",
  edgeColor: "#eadfcf",
});

export const ROOF_THICKNESS_METERS = 0.08;
export const ROOF_CEILING_DEPTH_METERS = 0.16;
export const ROOF_MAX_RISE_METERS = 2;
export const ROOF_PITCH_RADIANS = (25 * Math.PI) / 180;
