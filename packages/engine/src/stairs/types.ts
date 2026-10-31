import type { FloorCoordinates, FloorSpec, PlanPoint } from "../types";
import type { HomeProject, SceneItemSpec } from "../home-project/types";

interface StairConnection {
  /** Sides when ascending; omitted means both. */
  railings?: "both" | "left" | "right" | "none";
  id: string;
  lowerFloorId: string;
  upperFloorId: string;
  /** Lower entrance for flights; center for spiral stairs, in plan coordinates. */
  at: PlanPoint;
  /** Local forward is world +Z at zero. */
  rotationYRadians: number;
}
export interface StraightStairSpec extends StairConnection {
  /** Omitted in legacy V2 projects. */
  shape?: "straight";
  widthMeters: number;
  runMeters: number;
}
export interface LShapedStairSpec extends StairConnection {
  shape: "l-shaped";
  widthMeters: number;
  lowerRunMeters: number;
  upperRunMeters: number;
  turn: "left" | "right";
}
export interface UShapedStairSpec extends Omit<LShapedStairSpec, "shape"> {
  shape: "u-shaped";
}
export interface SpiralStairSpec extends StairConnection {
  shape: "spiral";
  diameterMeters: number;
  totalTurnDegrees: number;
  direction: "clockwise" | "counterclockwise";
}
export type StairSpec = StraightStairSpec | LShapedStairSpec | UShapedStairSpec | SpiralStairSpec;
export type StairShape = NonNullable<StairSpec["shape"]>;
export interface StairPathPoint {
  x: number;
  z: number;
  elevation: number;
}
export interface StairTread {
  polygon: readonly (readonly [number, number])[];
  elevation: number;
}
export interface StairShapeGeometry {
  path: StairPathPoint[];
  footprint: readonly (readonly [number, number])[];
  treads: StairTread[];
  widthMeters: number;
  runMeters: number;
}
export interface BuildingGeometry {
  home?: Pick<HomeProject["home"], "terrain" | "apartmentFloor">;
  coordinates: FloorCoordinates;
  floors: readonly (Omit<FloorSpec, "footprint"> & { footprint: readonly PlanPoint[] })[];
  stairs: readonly StairSpec[];
  sceneItems: readonly SceneItemSpec[];
}
