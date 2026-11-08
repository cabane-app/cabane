import { roofRegionSurface } from "./roof-region-surface";
import { DEFAULT_WALL_COLORS } from "../wall-colors";
import polygonClipping, { type Polygon as ClipPolygon } from "polygon-clipping";
import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";
import type { FloorSpec } from "../types";
import { deriveFloorLevels } from "../building/floor-levels";
import { deriveRoofRegions, type RoofRegion } from "./roof-coverage";
import {
  DEFAULT_ROOF_SETTINGS,
  ROOF_CEILING_DEPTH_METERS,
  ROOF_THICKNESS_METERS,
  type RoofSettings,
} from "./roof-settings";
import { createRoofWallLookup, roofWallFaceColor } from "./roof-wall-finish";
import { createRoofGableSpans } from "./roof-gable-spans";
import {
  alignRoofRim,
  roofRimOffset,
  roofWallCenterlinePoint,
  type RoofRimSegment,
} from "./roof-rim";
import { splitSlopeRim, splitSlopeSurface } from "./roof-slope-profile";
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
  walls: ReturnType<typeof createRoofWallLookup>,
  settings: RoofSettings,
  exteriorColor: string,
  interiorColor: string,
  top: number[],
  edges: number[],
  infill: number[],
  infillColors: number[],
  slopes: readonly RoofRegion[],
  gableSpans?: ReturnType<typeof createRoofGableSpans>,
) {
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
  const rims = region.polygon.map((sourceRing, ringIndex) => {
    const ring = openRing(sourceRing);
    const rim: RoofRimSegment[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const seams = sharedSlopeEdgeSpans(region, slopes, a, b);
      const gables = gableSpans?.(a, b, heightAt) ?? [];
      const breaks = [
        0,
        ...walls.breaks(a, b),
        ...seams.flat(),
        ...gables.flatMap(({ start, end }) => [start, end]),
        1,
      ];
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
        const p = at(cuts[j]);
        const q = at(cuts[j + 1]);
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
        const seam = seams.some(([start, end]) => start <= middle && middle <= end);
        const gable = gables.find(({ start, end }) => start <= middle && middle <= end);
        const support = seam ? undefined : (gable ?? walls.find(p, q));
        const supportedRim = region.heightAt && ringIndex === 0 && !seam ? support : undefined;
        rim.push({
          from: p,
          to: q,
          seam,
          gabled: gable !== undefined,
          finish: roofWallFaceColor(support, p, q, exteriorColor),
          support: supportedRim,
          offset: roofRimOffset(supportedRim, p, q),
        });
      }
    }
    return rim;
  });
  const { slopeProgressAt } = region;
  const alignRim = (rim: RoofRimSegment[]) => {
    const aligned = alignRoofRim(rim);
    return slopeProgressAt ? splitSlopeRim(aligned, slopeProgressAt) : aligned;
  };
  const outerRims = rims.map(alignRim);
  const authoredOutline = () => outerRims.map((rim) => rim.map(({ from }) => from));
  const surfaces = region.heightAt
    ? slopeProgressAt
      ? splitSlopeSurface(authoredOutline(), slopeProgressAt)
      : [authoredOutline()]
    : settings.direction === "flat"
      ? [region.polygon]
      : halves.flatMap((half) => polygonClipping.intersection(region.polygon, half));
  for (const polygon of surfaces) {
    appendSurface(top, polygon, topHeight);
    appendSurface(edges, polygon, heightAt, true);
  }
  // The ceiling remains an interior surface. Exterior infill closes the full
  // slab/gable depth down to it; only the roof skin uses the trim material.
  const bottom = region.baseHeight - ROOF_CEILING_DEPTH_METERS;
  const gableTop = (point: Point, support: RoofRimSegment["support"]) =>
    heightAt(support ? roofWallCenterlinePoint(point, support) : point) - ROOF_CEILING_DEPTH_METERS;
  const addInfill = (p0: number[], p1: number[], q0: number[], q1: number[], finish: string) => {
    infill.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
    const color = new Color(finish);
    for (let vertex = 0; vertex < 6; vertex++) infillColors.push(color.r, color.g, color.b);
  };
  for (const rim of outerRims) {
    for (const { from: p, to: q, seam, gabled, finish, support } of rim) {
      if (seam || Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
      const p1 = [p[0], heightAt(p), p[1]],
        p2 = [p[0], p1[1] + ROOF_THICKNESS_METERS, p[1]];
      const q1 = [q[0], heightAt(q), q[1]],
        q2 = [q[0], q1[1] + ROOF_THICKNESS_METERS, q[1]];
      // A gable reaches the ceiling. Close the remaining depth up to the roof skin.
      const p0 = [p[0], gabled ? Math.min(p1[1], gableTop(p, support)) : bottom, p[1]];
      const q0 = [q[0], gabled ? Math.min(q1[1], gableTop(q, support)) : bottom, q[1]];
      edges.push(...p1, ...p2, ...q2, ...p1, ...q2, ...q1);
      addInfill(p0, p1, q0, q1, finish);
    }
  }

  if (!region.heightAt) return;
  // Close the cavity above the wall on its room side, hiding the wall's top cap.
  const innerRim = alignRim(
    rims[0].map((segment) => ({
      ...segment,
      offset: roofRimOffset(segment.support, segment.from, segment.to, "inside"),
    })),
  );
  for (const { from: p, to: q, support, offset, gabled } of innerRim) {
    if (!support || !offset || Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
    const baseAt = (point: Point) =>
      gabled ? gableTop(point, support) : Math.max(bottom, walls.top(support.wall));
    const pTop = heightAt(p);
    const qTop = heightAt(q);
    const pBase = Math.min(pTop, baseAt(p));
    const qBase = Math.min(qTop, baseAt(q));
    if (pTop - pBase < 1e-6 && qTop - qBase < 1e-6) continue;
    addInfill(
      [q[0], qBase, q[1]],
      [q[0], qTop, q[1]],
      [p[0], pBase, p[1]],
      [p[0], pTop, p[1]],
      roofWallFaceColor(support, p, q, interiorColor, false),
    );
  }
}

export function buildRoofGeometries(
  floors: readonly FloorSpec[],
  settings: RoofSettings = DEFAULT_ROOF_SETTINGS,
  exteriorColor: string = DEFAULT_WALL_COLORS.exterior,
  interiorColor: string = DEFAULT_WALL_COLORS.interior,
) {
  const top: number[] = [],
    edges: number[] = [],
    infill: number[] = [],
    infillColors: number[] = [];
  const byId = new Map(floors.map((floor) => [floor.id, floor]));
  const regions = deriveRoofRegions(floors);
  const slopes = regions.filter((region) => region.heightAt);
  const wallsByFloor = new Map<string, ReturnType<typeof createRoofWallLookup>>();
  const levels = slopes.length ? deriveFloorLevels(floors) : [];
  const levelsByFloor = new Map(
    levels.map(({ floorId, elevationMeters }, index) => [
      floorId,
      { elevationMeters, hasAbove: index + 1 < floors.length },
    ]),
  );
  // A gable can rise from a lower storey into the roof over the floor above.
  const gableLookups = levels.flatMap(({ floorId, elevationMeters }) => {
    const floor = byId.get(floorId)!;
    return floor.walls.some((wall) => wall.gable)
      ? [createRoofGableSpans(floor, elevationMeters)]
      : [];
  });
  const gableSpans: ReturnType<typeof createRoofGableSpans> | undefined = gableLookups.length
    ? (from, to, heightAt) => gableLookups.flatMap((lookup) => lookup(from, to, heightAt))
    : undefined;
  for (const region of regions) {
    const floor = byId.get(region.floorId)!;
    let walls = wallsByFloor.get(floor.id);
    if (!walls) {
      walls = createRoofWallLookup(floor, levelsByFloor.get(floor.id));
      wallsByFloor.set(floor.id, walls);
    }
    appendRegion(
      region,
      walls,
      settings,
      exteriorColor,
      interiorColor,
      top,
      edges,
      infill,
      infillColors,
      slopes,
      region.heightAt ? gableSpans : undefined,
    );
  }
  const wallInfill = meshGeometry(infill);
  wallInfill.setAttribute("color", new Float32BufferAttribute(infillColors, 3));
  return { top: meshGeometry(top), edges: meshGeometry(edges), infill: wallInfill };
}
