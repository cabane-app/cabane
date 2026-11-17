import {
  intersectClippingGeometry,
  unionClippingPolygons,
} from "../architecture-geometry/architecture-clipping";
import { planPointToWorld } from "../geometry";
import type { FloorSpec } from "../types";
import { elevationAreas } from "./surfaces";
import type { MultiPolygon, Polygon } from "polygon-clipping";

/** Continue the existing wall solids down beside a lowered indoor area. */
export function lowerWallFootprint(floor: FloorSpec, footprint: MultiPolygon, height: number) {
  const width = Math.max(0.1, ...floor.walls.map((wall) => wall.thicknessMeters));
  const polygons: Polygon[] = [];
  for (const area of elevationAreas(floor)) {
    if (!area.roomId || area.elevation.offsetMeters > height) continue;
    const points = area.polygon.map(
      (point) => [...planPointToWorld(point, floor.coordinates)] as [number, number],
    );
    polygons.push([points]);
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = ((b[1] - a[1]) / length) * width,
        dz = (-(b[0] - a[0]) / length) * width;
      polygons.push([
        [
          [a[0] + dx, a[1] + dz],
          [b[0] + dx, b[1] + dz],
          [b[0] - dx, b[1] - dz],
          [a[0] - dx, a[1] - dz],
        ],
      ]);
      polygons.push([
        [
          [a[0] - width, a[1] - width],
          [a[0] + width, a[1] - width],
          [a[0] + width, a[1] + width],
          [a[0] - width, a[1] + width],
        ],
      ]);
    });
  }
  return polygons.length
    ? intersectClippingGeometry(footprint, unionClippingPolygons(polygons))
    : [];
}
