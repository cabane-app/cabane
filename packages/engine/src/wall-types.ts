import type { PlanPoint } from "./types";

export interface WallNicheSpec {
  id: string;
  side: "left" | "right";
  offsetFromWallStartPlanUnits: number;
  widthPlanUnits: number;
  bottomMeters: number;
  heightMeters: number;
  depthMeters: number;
  /** Shelf bottom heights measured upward from the niche bottom. White wall finish. */
  shelfHeightsMeters?: readonly number[];
  shelfThicknessMeters?: number;
}

export const WALL_SURFACE_PATTERNS = [
  "square-tile",
  "subway-tile",
  "striped-wallpaper",
  "dotted-wallpaper",
] as const;
export interface WallSurfaceFinish {
  pattern: (typeof WALL_SURFACE_PATTERNS)[number];
  color: string;
  /** Width and height of one complete pattern repeat, in meters. */
  repeatMeters: number;
}

export interface WallSpec {
  id: string;
  name?: string;
  from: PlanPoint;
  to: PlanPoint;
  classification: "interior" | "exterior";
  thicknessMeters: number;
  /**
   * A virtual wall only divides rooms: it has no geometry, collision, shadow or
   * openings, and renders and collides as open floor.
   */
  virtual?: boolean;
  niches?: readonly WallNicheSpec[];
  heightMeters?: number;
  exteriorColor?: string;
  edgeColor?: string;
  faceFinishes?: { left?: WallSurfaceFinish; right?: WallSurfaceFinish };
  faceColors?: {
    left?: string;
    right?: string;
  };
}

export interface WallJunctionSpec {
  id: string;
  at: PlanPoint;
  wallIds: readonly [string, string, ...string[]];
}
