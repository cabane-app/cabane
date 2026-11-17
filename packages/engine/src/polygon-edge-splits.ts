import type { PlanPoint } from "./types";

/** Sorted parameters at crossings and the endpoints of collinear overlaps. */
export function polygonEdgeSplits(
  a: PlanPoint,
  b: PlanPoint,
  polygons: readonly (readonly PlanPoint[])[],
) {
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
