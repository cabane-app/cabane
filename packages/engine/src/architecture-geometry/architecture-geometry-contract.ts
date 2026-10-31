import { type Polygon as ClippingPolygon, type MultiPolygon } from "polygon-clipping";

import type { FloorSpec } from "../types";

export type Horizontal = readonly [number, number];

export type WallPlanFloor = Pick<
  FloorSpec,
  "walls" | "wallJunctions" | "coordinates" | "footprint" | "footprintRegions"
>;

export type MaterialBucket = 0 | 1;

export const EPSILON = 1e-6;

// Geometry booleans feed intersections back into later wall, slab and aperture
// cuts. Snap those intermediate coordinates to a sub-micron
// grid so polygon-clipping sees coincident edges as identical, while remaining
// far below any visible or authored measurement precision.
export const CLIPPING_GRID_METERS = 1e-7;

export const JUNCTION_SEAM_OVERLAP_METERS = 0.012;

export type ClippingGeometry = ClippingPolygon | MultiPolygon;
