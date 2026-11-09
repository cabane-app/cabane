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
export interface WallPatternFinish {
  pattern: (typeof WALL_SURFACE_PATTERNS)[number];
  color: string;
  /** Width and height of one complete pattern repeat, in meters. */
  repeatMeters: number;
}

export interface WallSurfaceImage {
  name: string;
  /** An optimized, opaque JPEG, embedded so ordinary project transfers retain it. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface WallImageFinish {
  pattern: "custom-image";
  color: "#ffffff";
  /** Physical width of the complete image. Height follows its aspect ratio. */
  repeatMeters: number;
  image: WallSurfaceImage;
}

export type WallSurfaceFinish = WallPatternFinish | WallImageFinish;

export function wallSurfaceRepeatHeight(finish: WallSurfaceFinish | undefined): number {
  if (!finish) return 1;
  return (
    finish.repeatMeters *
    (finish.pattern === "custom-image" ? finish.image.height / finish.image.width : 1)
  );
}

/**
 * The part of a wall that rises above heightMeters to the sloped ceiling over it,
 * such as the triangle at the end of an A-frame. Without a sloped ceiling above
 * it, the wall stops at heightMeters as usual.
 */
export type WallGableSpec =
  | { fill: "solid" }
  | {
      /** Glass fills the gable above heightMeters, which then acts as its header. */
      fill: "glass";
      frameColor?: string;
      /** Glass panes across the gable, split by vertical mullions (default 2). */
      columns?: number;
      /** Heights above the floor of horizontal transoms in a glass gable. */
      transomHeightsMeters?: readonly number[];
    };

export const MAX_GABLE_COLUMNS = 32;
export const MAX_GABLE_TRANSOMS = 32;

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
  /** How far the wall's top sits outward of its base (negative leans in). */
  leanMeters?: number;
  exteriorColor?: string;
  edgeColor?: string;
  faceFinishes?: { left?: WallSurfaceFinish; right?: WallSurfaceFinish };
  faceColors?: {
    left?: string;
    right?: string;
  };
  gable?: WallGableSpec;
}

export interface WallJunctionSpec {
  id: string;
  at: PlanPoint;
  wallIds: readonly [string, string, ...string[]];
}
