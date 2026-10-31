import type { FloorCoordinates, FloorSpec, PlanPoint } from "../types";
import type { HomeProject, SceneItemSpec } from "../home-project/types";

export type StairStyle = "open" | "concrete" | "stone";
interface StairPlacement {
  /** Omitted means the original open treads. Independent of the stair connection. */
  style?: StairStyle;
  /** Sides when ascending; omitted means both. */
  railings?: "both" | "left" | "right" | "none";
  id: string;
  /** Lower entrance for flights; center for spiral stairs, in plan coordinates. */
  at: PlanPoint;
  /** Local forward is world +Z at zero. */
  rotationYRadians: number;
}
export type StairConnection =
  | { lowerFloorId: string; upperFloorId: string; terrain?: never }
  | {
      terrain: { floorId: string; end: "lower" | "upper" };
      lowerFloorId?: never;
      upperFloorId?: never;
    };
export type StraightStairSpec = StairPlacement &
  StairConnection & {
    /** Omitted in legacy V2 projects. */
    shape?: "straight";
    widthMeters: number;
    runMeters: number;
  };
export type LShapedStairSpec = StairPlacement &
  StairConnection & {
    shape: "l-shaped";
    widthMeters: number;
    lowerRunMeters: number;
    upperRunMeters: number;
    turn: "left" | "right";
  };
export type UShapedStairSpec = StairPlacement &
  StairConnection & {
    shape: "u-shaped";
    widthMeters: number;
    lowerRunMeters: number;
    upperRunMeters: number;
    turn: "left" | "right";
  };
export type SpiralStairSpec = StairPlacement &
  StairConnection & {
    shape: "spiral";
    diameterMeters: number;
    totalTurnDegrees: number;
    direction: "clockwise" | "counterclockwise";
  };
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
