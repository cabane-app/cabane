import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { planPointToWorld } from "../geometry";
import type { FloorCoordinates } from "../types";
import type { StairFlight } from "./flight-geometry";

type Point = readonly [number, number];
const STAIR_CONTACT_EPSILON = 1e-7;
export const stairPolygon = (points: readonly Point[]): MultiPolygon =>
  points.length < 3 ? [] : [[points.map((p) => [p[0], p[1]])]];
const stairPolygonArea = (geometry: MultiPolygon) =>
  geometry.reduce(
    (total, polygon) =>
      total +
      polygon.reduce((area, ring, index) => {
        const signed = ring.reduce((sum, p, i) => {
          const q = ring[(i + 1) % ring.length];
          return sum + p[0] * q[1] - q[0] * p[1];
        }, 0);
        return area + ((index === 0 ? 1 : -1) * Math.abs(signed)) / 2;
      }, 0),
    0,
  );

export function stairVolume(footprint: MultiPolygon, bottom: number, top: number) {
  const points = footprint.flat(2);
  return {
    footprint,
    bottom,
    top,
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minZ: Math.min(...points.map((p) => p[1])),
    maxZ: Math.max(...points.map((p) => p[1])),
  };
}
export type StairVolume = ReturnType<typeof stairVolume>;
export function stairVolumesIntersect(a: StairVolume, b: StairVolume) {
  if (
    Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) <= STAIR_CONTACT_EPSILON ||
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) <= STAIR_CONTACT_EPSILON ||
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) <= STAIR_CONTACT_EPSILON
  )
    return false;
  return (
    stairPolygonArea(polygonClipping.intersection(a.footprint, b.footprint)) > STAIR_CONTACT_EPSILON
  );
}

/** Rendered tread slabs or masonry bodies, plus spiral bridges. */
export function stairStructureVolumes(flight: StairFlight) {
  const base = flight.baseElevationMeters;
  const volumes = flight.treads.map((tread) =>
    stairVolume(
      stairPolygon(tread.polygon),
      base + (flight.style && flight.style !== "open" ? -0.06 : tread.elevation - 0.12),
      base + tread.elevation,
    ),
  );
  if (flight.shape === "spiral") {
    const top = base + flight.riseMeters;
    volumes.push(
      stairVolume(
        stairPolygon(
          flight.upperLanding.map((point) => planPointToWorld(point, flight.coordinates)),
        ),
        top - 0.12,
        top,
      ),
    );
  }
  return volumes;
}

/** Actual tread footprints, including turning treads, with the existing 1.8 m walking clearance. */
export function stairClearanceVolumes(flight: StairFlight, coordinates: FloorCoordinates) {
  const base = flight.baseElevationMeters;
  return [
    ...flight.treads.map((tread) =>
      stairVolume(
        stairPolygon(tread.polygon),
        base + tread.elevation - 0.12,
        base + tread.elevation + 1.8,
      ),
    ),
    ...[flight.lowerLanding, flight.upperLanding].map((landing, index) => {
      const elevation = base + (index ? flight.riseMeters : 0);
      return stairVolume(
        stairPolygon(landing.map((p) => planPointToWorld(p, coordinates))),
        elevation,
        elevation + 1.8,
      );
    }),
  ];
}

export function stairLandingSupported(
  landing: readonly Point[],
  regions: readonly (readonly Point[])[],
  coordinates: FloorCoordinates,
) {
  const subject = stairPolygon(landing.map((p) => planPointToWorld(p, coordinates)));
  const floors = regions
    .map((region) => stairPolygon(region.map((p) => planPointToWorld(p, coordinates))))
    .filter((region) => region.length);
  return (
    floors.length > 0 &&
    stairPolygonArea(polygonClipping.difference(subject, ...floors)) <= STAIR_CONTACT_EPSILON
  );
}
