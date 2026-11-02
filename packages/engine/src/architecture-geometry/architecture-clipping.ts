import polygonClipping, {
  type Polygon as ClippingPolygon,
  type MultiPolygon,
} from "polygon-clipping";

import { CLIPPING_GRID_METERS, ClippingGeometry } from "./architecture-geometry-contract";

const sameClippingPoint = (left: readonly [number, number], right: readonly [number, number]) =>
  left[0] === right[0] && left[1] === right[1];

const normalizeClippingRing = (
  ring: readonly (readonly [number, number])[],
): [number, number][] | null => {
  const points: [number, number][] = [];
  for (const [x, z] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const candidate: [number, number] = [
      Math.round(x / CLIPPING_GRID_METERS) * CLIPPING_GRID_METERS,
      Math.round(z / CLIPPING_GRID_METERS) * CLIPPING_GRID_METERS,
    ];
    if (!points.length || !sameClippingPoint(points[points.length - 1], candidate)) {
      points.push(candidate);
    }
  }
  if (points.length > 1 && sameClippingPoint(points[0], points[points.length - 1])) points.pop();
  if (points.length < 3) return null;
  points.push([...points[0]]);
  return points;
};

const normalizeClippingPolygon = (polygon: ClippingPolygon): ClippingPolygon | null => {
  const exterior = normalizeClippingRing(polygon[0] ?? []);
  if (!exterior) return null;
  return [
    exterior,
    ...polygon
      .slice(1)
      .map(normalizeClippingRing)
      .filter((ring): ring is [number, number][] => ring !== null),
  ];
};

const normalizeClippingMultiPolygon = (geometry: MultiPolygon): MultiPolygon =>
  geometry
    .map(normalizeClippingPolygon)
    .filter((polygon): polygon is ClippingPolygon => polygon !== null);

const normalizeClippingGeometry = (geometry: ClippingGeometry): ClippingGeometry => {
  const isPolygon = typeof geometry[0]?.[0]?.[0] === "number";
  return isPolygon
    ? (normalizeClippingPolygon(geometry as ClippingPolygon) ?? [])
    : normalizeClippingMultiPolygon(geometry as MultiPolygon);
};

const clippingMultiPolygon = (geometry: ClippingGeometry): MultiPolygon =>
  typeof geometry[0]?.[0]?.[0] === "number"
    ? [geometry as ClippingPolygon]
    : (geometry as MultiPolygon);

export const unionClippingPolygons = (polygons: readonly ClippingPolygon[]): MultiPolygon => {
  const normalized = polygons
    .map(normalizeClippingPolygon)
    .filter((polygon): polygon is ClippingPolygon => polygon !== null);
  return normalized[0]
    ? normalizeClippingMultiPolygon(polygonClipping.union(normalized[0], ...normalized.slice(1)))
    : [];
};

export const differenceClippingGeometry = (
  subject: ClippingGeometry,
  ...clips: ClippingGeometry[]
): MultiPolygon => {
  const normalizedSubject = normalizeClippingGeometry(subject);
  if (!normalizedSubject[0]) return [];
  const normalizedClips = clips.map(normalizeClippingGeometry).filter((geometry) => geometry[0]);
  return normalizeClippingMultiPolygon(
    normalizedClips.length
      ? polygonClipping.difference(normalizedSubject, ...normalizedClips)
      : clippingMultiPolygon(normalizedSubject),
  );
};

export const intersectClippingGeometry = (
  subject: ClippingGeometry,
  ...clips: ClippingGeometry[]
): MultiPolygon => {
  const normalizedSubject = normalizeClippingGeometry(subject);
  if (!normalizedSubject[0]) return [];
  const normalizedClips = clips.map(normalizeClippingGeometry);
  if (normalizedClips.some((geometry) => !geometry[0])) return [];
  return normalizeClippingMultiPolygon(
    normalizedClips.length
      ? polygonClipping.intersection(normalizedSubject, ...normalizedClips)
      : clippingMultiPolygon(normalizedSubject),
  );
};
