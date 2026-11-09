import { BufferGeometry, Float32BufferAttribute, ShapeGeometry } from "three";
import { planPointToWorld, polygonSignedArea, worldPointToPlan } from "../geometry";
import { floorZonePointWithinRoom } from "../floor-finishes/finish-geometry";
import { cutSurfaceShapes } from "../stairs/surface-apertures";
import type { FloorSpec, PlanPoint, Polygon } from "../types";
import {
  elevationAreas,
  localSurfaceAt,
  transitionOutline,
  triangleHeight,
  transitionTriangles,
} from "./surfaces";

function splitEdge(a: PlanPoint, b: PlanPoint, polygons: readonly Polygon[]) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    result = [0, 1];
  for (const polygon of polygons)
    polygon.forEach((c, i) => {
      const d = polygon[(i + 1) % polygon.length],
        ex = d[0] - c[0],
        ey = d[1] - c[1];
      const det = dx * ey - dy * ex;
      if (Math.abs(det) < 1e-9) {
        for (const p of [c, d])
          if (Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) < 1e-8) {
            const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
            if (t > 0 && t < 1) result.push(t);
          }
        return;
      }
      const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / det;
      const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / det;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) result.push(t);
    });
  return [...new Set(result)].sort((a, b) => a - b);
}

export function elevationEdgeGeometry(
  floor: FloorSpec,
  groundAt: (point: PlanPoint) => number,
  apertures: readonly Polygon[] = [],
) {
  const positions: number[] = [];
  const add = (point: PlanPoint, height: number) => {
    const [x, z] = planPointToWorld(point, floor.coordinates);
    positions.push(x, height, z);
  };
  const areas = elevationAreas(floor);
  for (const area of areas) {
    const outer = transitionOutline(area, floor.coordinates.metersPerPlanUnit);
    const others = {
      ...floor,
      rooms: floor.rooms.map((room) => ({
        ...room,
        floorZones: room.floorZones?.filter((z) => z.id !== area.id) ?? [],
      })),
      outdoorPlatforms: floor.outdoorPlatforms?.filter((p) => p.id !== area.id) ?? [],
    };
    for (let i = 0; i < area.polygon.length; i++) {
      const j = (i + 1) % area.polygon.length,
        a = area.polygon[i],
        b = area.polygon[j],
        h = area.elevation.offsetMeters;
      if (area.elevation.edges[i]?.transition?.kind === "sloped") {
        for (const triangle of transitionTriangles(
          area,
          floor.coordinates.metersPerPlanUnit,
          groundAt,
        ).filter((triangle) => triangle.edge === i)) {
          const source = new ShapeGeometry(
            cutSurfaceShapes(triangle.polygon, floor.coordinates, apertures),
          );
          const geometry = source.index ? source.toNonIndexed() : source;
          const attribute = geometry.getAttribute("position");
          for (let k = 0; k < attribute.count; k++) {
            const point = worldPointToPlan(
              { x: attribute.getX(k), z: -attribute.getY(k) },
              floor.coordinates,
            );
            // Clipping and GPU attributes round coordinates. Evaluate the plane
            // without a second containment test that could drop a rim vertex.
            add(point, triangleHeight(point, triangle.polygon, triangle.heights, false) ?? h);
          }
          if (source !== geometry) source.dispose();
          geometry.dispose();
        }
        continue;
      }
      // Adjacent slopes extend past this edge's original endpoints. Close their
      // exposed triangular sides, not just the rectangle below the flat area.
      for (const [inner, outside] of [
        [a, outer[i]],
        [b, outer[j]],
      ]) {
        if (Math.hypot(inner[0] - outside[0], inner[1] - outside[1]) < 1e-8) continue;
        const base = area.roomId ? 0 : groundAt(inner);
        add(inner, h);
        add(inner, base);
        add(outside, area.roomId ? 0 : groundAt(outside));
      }
      const splits = splitEdge(a, b, [
        ...apertures,
        ...areas.filter((p) => p.id !== area.id).map((p) => p.polygon),
      ]);
      const at = (t: number): PlanPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      for (let k = 1; k < splits.length; k++) {
        const middle = at((splits[k - 1] + splits[k]) / 2);
        if (apertures.some((polygon) => floorZonePointWithinRoom(middle, polygon))) continue;
        const sign = Math.sign(polygonSignedArea(area.polygon));
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const probe: PlanPoint = [
          middle[0] + ((sign * (b[1] - a[1])) / length) * 1e-5,
          middle[1] - ((sign * (b[0] - a[0])) / length) * 1e-5,
        ];
        const neighbor = localSurfaceAt(others, probe, groundAt);
        if (neighbor.id !== floor.id && h <= neighbor.elevation) continue;
        const from = at(splits[k - 1]),
          to = at(splits[k]);
        const surrounding = (point: PlanPoint) =>
          neighbor.id !== floor.id ? neighbor.elevation : area.roomId ? 0 : groundAt(point);
        const points = [from, to, to, from],
          heights = [h, h, surrounding(to), surrounding(from)];
        for (const index of [0, 1, 2, 0, 2, 3]) add(points[index], heights[index]);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
