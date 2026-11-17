import { pointInsidePolygon } from "../geometry";

type Point = readonly [number, number];
/** Clip a rail to supported intervals, probing just outside the stair opening. */
export function supportedGuardIntervals(
  a: Point,
  b: Point,
  offset: Point,
  polygons: readonly (readonly Point[])[],
  supports?: (point: Point) => boolean,
) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const start: Point = [a[0] + offset[0], a[1] + offset[1]];
  const breaks = [0, 1];
  for (const polygon of polygons)
    polygon.forEach((p, i) => {
      const q = polygon[(i + 1) % polygon.length],
        ex = q[0] - p[0],
        ez = q[1] - p[1];
      const determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 1e-10) return;
      const px = p[0] - start[0],
        pz = p[1] - start[1];
      const t = (px * ez - pz * ex) / determinant,
        u = (px * dz - pz * dx) / determinant;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) breaks.push(t);
    });
  breaks.sort((x, y) => x - y);
  return breaks.slice(1).flatMap((end, i): [number, number][] => {
    const begin = breaks[i],
      mid = (begin + end) / 2;
    const at = (t: number): Point => [start[0] + dx * t, start[1] + dz * t];
    // Probe inside each boundary interval: a slope cannot support a horizontal guard.
    const inset = Math.min(1e-6, (end - begin) / 4);
    const supported = supports
      ? [begin + inset, mid, end - inset].every((t) => supports(at(t)))
      : polygons.some((p) => pointInsidePolygon(at(mid), p));
    return end - begin > 1e-8 && supported ? [[begin, end]] : [];
  });
}
