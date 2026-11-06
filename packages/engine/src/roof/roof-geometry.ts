import { roofRegionSurface } from "./roof-region-surface";
import { DEFAULT_WALL_COLORS } from "../wall-colors";
import polygonClipping, { type Polygon as ClipPolygon } from "polygon-clipping";
import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";
import type { FloorSpec } from "../types";
import { deriveRoofRegions, type RoofRegion } from "./roof-coverage";
import { DEFAULT_ROOF_SETTINGS, ROOF_THICKNESS_METERS, type RoofSettings } from "./roof-settings";
import { roofWallBreaks, createRoofWallFinish } from "./roof-wall-finish";
import { sharedSlopeEdgeSpans } from "./roof-slope-seams";

type Point = [number, number];
const openRing = (ring: Point[]): Point[] =>
  ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]
    ? ring.slice(0, -1)
    : ring;

const meshGeometry = (positions: number[]): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

function appendSurface(
  positions: number[],
  polygon: ClipPolygon,
  heightAt: (point: Point) => number,
  underside = false,
) {
  const rings = polygon.map((ring) => openRing(ring).map(([x, z]) => new Vector2(x, z)));
  const points = rings.flat();
  for (const triangle of ShapeUtils.triangulateShape(rings[0], rings.slice(1))) {
    const vertices = triangle.map((index) => points[index]);
    const [a, b, c] = vertices;
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    // In x/z coordinates a clockwise triangle faces upward.
    if (cross > 0 !== underside) vertices.reverse();
    for (const point of vertices) positions.push(point.x, heightAt([point.x, point.y]), point.y);
  }
}

function appendRegion(
  region: RoofRegion,
  slopes: readonly RoofRegion[],
  floor: FloorSpec,
  settings: RoofSettings,
  exteriorColor: string,
  top: number[],
  edges: number[],
  infill: number[],
  infillColors: number[],
) {
  const roofWallFinish = createRoofWallFinish(floor);
  const points = region.polygon[0];
  const { axis, ridge, heightAt } = roofRegionSurface(region, settings);
  const topHeight = (point: Point) => heightAt(point) + ROOF_THICKNESS_METERS;
  const minX = Math.min(...points.map((point) => point[0])) - 1,
    maxX = Math.max(...points.map((point) => point[0])) + 1;
  const minZ = Math.min(...points.map((point) => point[1])) - 1,
    maxZ = Math.max(...points.map((point) => point[1])) + 1;
  const halves: ClipPolygon[] =
    axis === 1
      ? [
          [
            [
              [minX, minZ],
              [maxX, minZ],
              [maxX, ridge],
              [minX, ridge],
            ],
          ],
          [
            [
              [minX, ridge],
              [maxX, ridge],
              [maxX, maxZ],
              [minX, maxZ],
            ],
          ],
        ]
      : [
          [
            [
              [minX, minZ],
              [ridge, minZ],
              [ridge, maxZ],
              [minX, maxZ],
            ],
          ],
          [
            [
              [ridge, minZ],
              [maxX, minZ],
              [maxX, maxZ],
              [ridge, maxZ],
            ],
          ],
        ];
  const surfaces =
    region.heightAt || settings.direction === "flat"
      ? [region.polygon]
      : halves.flatMap((half) => polygonClipping.intersection(region.polygon, half));
  for (const polygon of surfaces) appendSurface(top, polygon, topHeight);
  // The ceiling remains an interior surface. Exterior infill closes the full
  // slab/gable depth down to it; only the roof skin uses the trim material.
  const bottom = () => region.baseHeight - 0.16;
  for (const polygon of surfaces) appendSurface(edges, polygon, heightAt, true);
  for (const sourceRing of region.polygon) {
    const ring = openRing(sourceRing);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const seams = sharedSlopeEdgeSpans(region, slopes, a, b);
      const breaks = [0, ...roofWallBreaks(floor, a, b), ...seams.flat(), 1];
      if (
        !region.heightAt &&
        settings.direction !== "flat" &&
        (a[axis] - ridge) * (b[axis] - ridge) < -1e-10
      ) {
        const t = (ridge - a[axis]) / (b[axis] - a[axis]);
        breaks.push(t);
      }
      const cuts = [...new Set(breaks)].sort((a, b) => a - b);
      const at = (t: number): Point => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      for (let j = 0; j < cuts.length - 1; j++) {
        const middle = (cuts[j] + cuts[j + 1]) / 2;
        if (seams.some(([start, end]) => middle > start && middle < end)) continue;
        const p = at(cuts[j]),
          q = at(cuts[j + 1]);
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
        const p0 = [p[0], bottom(), p[1]],
          p1 = [p[0], heightAt(p), p[1]],
          p2 = [p[0], topHeight(p), p[1]];
        const q0 = [q[0], bottom(), q[1]],
          q1 = [q[0], heightAt(q), q[1]],
          q2 = [q[0], topHeight(q), q[1]];
        edges.push(...p1, ...p2, ...q2, ...p1, ...q2, ...q1);
        infill.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
        const color = new Color(roofWallFinish(p, q, exteriorColor));
        for (let vertex = 0; vertex < 6; vertex++) infillColors.push(color.r, color.g, color.b);
      }
    }
  }
}

export function buildRoofGeometries(
  floors: readonly FloorSpec[],
  settings: RoofSettings = DEFAULT_ROOF_SETTINGS,
  exteriorColor: string = DEFAULT_WALL_COLORS.exterior,
) {
  const top: number[] = [],
    edges: number[] = [],
    infill: number[] = [],
    infillColors: number[] = [];
  const byId = new Map(floors.map((floor) => [floor.id, floor]));
  const regions = deriveRoofRegions(floors);
  const slopes = regions.filter((region) => region.heightAt);
  for (const region of regions)
    appendRegion(
      region,
      slopes,
      byId.get(region.floorId)!,
      settings,
      exteriorColor,
      top,
      edges,
      infill,
      infillColors,
    );
  const wallInfill = meshGeometry(infill);
  wallInfill.setAttribute("color", new Float32BufferAttribute(infillColors, 3));
  return { top: meshGeometry(top), edges: meshGeometry(edges), infill: wallInfill };
}
