import { createContext, useContext } from "react";
import { differenceClippingGeometry } from "../architecture-geometry/architecture-clipping";
import { Path, Shape } from "three";
import { planPointToWorld } from "../geometry";
import type { FloorCoordinates, PlanPoint, Polygon } from "../types";

export const StairSurfaceApertures = createContext<{
  floor: readonly Polygon[];
  ceiling: readonly Polygon[];
  terrain?: readonly Polygon[];
}>({ floor: [], ceiling: [], terrain: [] });
const EMPTY_APERTURES: readonly Polygon[] = [];
export const useStairSurfaceApertures = (surface: "floor" | "ceiling" | "terrain") =>
  useContext(StairSurfaceApertures)[surface] ?? EMPTY_APERTURES;
export const cutSurfaceShapes = (
  polygon: Polygon,
  coordinates: FloorCoordinates,
  apertures: readonly Polygon[],
): Shape[] => {
  const ring = (points: readonly PlanPoint[]): [number, number][] =>
    points.map((point) => [...planPointToWorld(point, coordinates)]);
  const clipped = differenceClippingGeometry(
    [ring(polygon)],
    ...apertures.map((hole) => [ring(hole)]),
  );
  return clipped.map((rings) => {
    const shape = new Shape();
    rings.forEach((points, index) => {
      const path = index === 0 ? shape : new Path();
      points.forEach(([x, z], i) => {
        if (i === 0) path.moveTo(x, -z);
        else path.lineTo(x, -z);
      });
      path.closePath();
      if (index > 0) shape.holes.push(path);
    });
    return shape;
  });
};
