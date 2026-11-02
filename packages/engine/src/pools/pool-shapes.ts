import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { Path, Shape } from "three";
import type { FloorSpec } from "../types";
import { isPoolOutline, poolExcavationFootprint } from "./pool-footprint";

export const poolShapes = (polygons: MultiPolygon): Shape[] =>
  polygons.map((rings) => {
    const shape = new Shape();
    rings.forEach((ring, index) => {
      const path = index === 0 ? shape : new Path();
      ring.forEach(([x, z], pointIndex) =>
        pointIndex === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z),
      );
      path.closePath();
      if (index > 0) shape.holes.push(path);
    });
    return shape;
  });

/** Excavate every ground layer with hidden clearance behind the visible basin lining. */
export function cutPoolOpenings(ground: Shape, floor: FloorSpec): Shape[] {
  const cuts = (floor.pools ?? [])
    .filter((pool) => isPoolOutline(pool.polygon))
    .map((pool) => poolExcavationFootprint(pool.polygon, floor.coordinates));
  if (!cuts.length) return [ground];
  const outline: MultiPolygon = [
    [ground, ...ground.holes].map((path) =>
      path.getPoints(12).map((point): [number, number] => [point.x, -point.y]),
    ),
  ];
  return poolShapes(polygonClipping.difference(outline, ...cuts));
}
