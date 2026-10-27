import { DEFAULT_WALL_COLORS } from "./wall-colors";
import { wallCapFinishRegions } from "./architecture-geometry/wall-cap-finishes";
import { wallStructuralHeight } from "./architecture-geometry/wall-structural-height";
import { wallSolidBands } from "./architecture-geometry/wall-solid-bands";
import { wallFaceFinish, wallEdgeFinish } from "./architecture-geometry/wall-face-finish";
import { wallLevelContact } from "./architecture-geometry/wall-level-contact";
import { type MultiPolygon } from "polygon-clipping";

import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";

import { GROUND_ELEVATION_METERS } from "./ground-elevation";

import { worldPointToPlan } from "./geometry";

import { differenceClippingGeometry } from "./architecture-geometry/architecture-clipping";
import { EPSILON, Horizontal } from "./architecture-geometry/architecture-geometry-contract";
import { uniqueSorted } from "./architecture-geometry/architecture-mesh-buckets";
import {
  normalize,
  pointInsideFloorFootprint,
  wallExteriorNormal,
  wallFrame,
} from "./architecture-geometry/wall-coordinate-frame";
import {
  ArchitecturalWallGeometryGroup,
  createWallAssemblyPointTest,
} from "./architecture-geometry/wall-solid-footprints";
import type { FloorSpec, WallSpec, WallSurfaceFinish } from "./types";

/** Generalized version of the original house-wide occupied-grid wall union. */
export function buildArchitecturalWallGeometries(
  sourceFloor: FloorSpec,
  interiorColor: string = DEFAULT_WALL_COLORS.interior,
  exteriorColor: string = DEFAULT_WALL_COLORS.exterior,
  baseElevationMeters = GROUND_ELEVATION_METERS,
  neighbors: { below?: FloorSpec; above?: FloorSpec } = {},
): ArchitecturalWallGeometryGroup[] {
  // Continue exterior finish across the structural slab between ceiling and next level.
  const floor = neighbors.above
    ? {
        ...sourceFloor,
        walls: sourceFloor.walls.map((wall) => ({
          ...wall,
          heightMeters: wallStructuralHeight(wall, sourceFloor),
        })),
      }
    : sourceFloor;
  const wallData = new Map(
    floor.walls.map((wall) => [
      wall,
      {
        frame: wallFrame(wall, floor),
        exteriorNormal: wallExteriorNormal(wall, floor),
        contains: createWallAssemblyPointTest(wall, floor),
      },
    ]),
  );
  type Buffers = {
    outwardNormal: Horizontal | null;
    fadeNormals: Horizontal[];
    positions: number[];
    colors: number[];
    indices: number[];
    uvs: number[];
    finish?: WallSurfaceFinish;
  };
  const bands = wallSolidBands(floor);

  const buffersByDirection = new Map<string, Buffers>();
  const buffersFor = (
    outwardNormal: Horizontal | null,
    key = outwardNormal
      ? `${outwardNormal[0].toFixed(4)}:${outwardNormal[1].toFixed(4)}`
      : "interior",
    fadeNormals: readonly Horizontal[] = outwardNormal ? [outwardNormal] : [],
  ) => {
    let buffers = buffersByDirection.get(key);
    if (!buffers) {
      buffers = { outwardNormal, fadeNormals: [], positions: [], colors: [], indices: [], uvs: [] };
      buffersByDirection.set(key, buffers);
    }
    for (const normal of fadeNormals) {
      if (
        buffers.fadeNormals.some(
          (candidate) =>
            Math.abs(candidate[0] - normal[0]) < EPSILON &&
            Math.abs(candidate[1] - normal[1]) < EPSILON,
        )
      )
        continue;
      buffers.fadeNormals.push(normal);
    }
    return buffers;
  };
  const insideColor = new Color(interiorColor);
  const outsideColor = new Color(exteriorColor);
  const customColors = new Map<string, Color>();
  const customColor = (value: string) => {
    let color = customColors.get(value);
    if (!color) {
      color = new Color(value);
      customColors.set(value, color);
    }
    return color;
  };
  const addTriangle = (
    buffers: Buffers,
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    color: Color,
    frame?: ReturnType<typeof wallFrame>,
  ) => {
    const offset = buffers.positions.length / 3;
    // Extend only floor-level vertices to terrain; preserve opening heads,
    // sills and wall tops, and keep doorway cutouts open down to the ground.
    for (const point of [a, b, c]) {
      const y = point[1] === 0 ? baseElevationMeters : point[1];
      buffers.positions.push(point[0], y, point[2]);
      const repeat = buffers.finish?.repeatMeters ?? 1;
      buffers.uvs.push(
        frame
          ? ((point[0] - frame.from[0]) * frame.direction[0] +
              (point[2] - frame.from[1]) * frame.direction[1]) /
              repeat
          : 0,
        y / repeat,
      );
    }
    for (let vertex = 0; vertex < 3; vertex += 1) buffers.colors.push(color.r, color.g, color.b);
    buffers.indices.push(offset, offset + 1, offset + 2);
  };
  const fadeNormalAt = (point: Horizontal, activeWalls: readonly WallSpec[]) => {
    const normals = activeWalls
      .filter((wall) => wallData.get(wall)!.contains(point))
      .map((wall) => wallData.get(wall)!.exteriorNormal)
      .filter((normal): normal is Horizontal => normal !== null);
    return normals.length
      ? normalize(
          normals.reduce<Horizontal>(
            (sum, normal) => [sum[0] + normal[0], sum[1] + normal[1]],
            [0, 0],
          ),
        )
      : null;
  };
  const addHorizontalSurface = (
    surface: MultiPolygon,
    elevation: number,
    upward: boolean,
    activeWalls: readonly WallSpec[],
  ) => {
    wallCapFinishRegions(surface, activeWalls, floor, interiorColor).forEach(
      ({ surface: region, color }) => {
        region.forEach((polygon) => {
          const contour = polygon[0].slice(0, -1).map(([x, z]) => new Vector2(x, z));
          const holes = polygon
            .slice(1)
            .map((ring) => ring.slice(0, -1).map(([x, z]) => new Vector2(x, z)));
          const vertices = [...contour, ...holes.flat()];
          ShapeUtils.triangulateShape(contour, holes).forEach(([first, second, third]) => {
            const points = [vertices[first], vertices[second], vertices[third]];
            const center: Horizontal = [
              (points[0].x + points[1].x + points[2].x) / 3,
              (points[0].y + points[1].y + points[2].y) / 3,
            ];
            // A cap belongs to the same camera-fade group as the wall directly
            // beneath it. This keeps its opacity synchronized with the wall face
            // instead of fading every cap whenever any exterior wall faces camera.
            const buffers = buffersFor(fadeNormalAt(center, activeWalls));
            const [a, b, c] = points.map((point) => [point.x, elevation, point.y] as const);
            if (upward) addTriangle(buffers, a, c, b, customColor(color));
            else addTriangle(buffers, a, b, c, customColor(color));
          });
        });
      },
    );
  };

  const wallFaceSurface = (
    center: Horizontal,
    edge: Horizontal,
    visibleNormal: Horizontal,
    activeWalls: readonly WallSpec[],
    outside: boolean,
    fallback: Color,
  ) => {
    const edgeDirection = normalize(edge);
    let owner: { wall: WallSpec; alignment: number } | null = null;
    for (const wall of activeWalls) {
      if (!wallData.get(wall)!.contains(center)) continue;
      const frame = wallData.get(wall)!.frame;
      const alignment = Math.abs(
        edgeDirection[0] * frame.direction[0] + edgeDirection[1] * frame.direction[1],
      );
      if (owner && alignment <= owner.alignment) continue;
      owner = { wall, alignment };
    }
    if (!owner) return { color: fallback };
    if (owner.alignment < 0.999)
      return { color: customColor(wallEdgeFinish(owner.wall, interiorColor)) };
    const normal = wallData.get(owner.wall)!.frame.normal;
    const side =
      visibleNormal[0] * normal[0] + visibleNormal[1] * normal[1] >= 0 ? "left" : "right";
    const finish = owner.wall.faceFinishes?.[side];
    return {
      color: finish
        ? customColor("white")
        : customColor(
            wallFaceFinish(owner.wall, side, outside, outside ? exteriorColor : interiorColor),
          ),
      finish,
      frame: wallData.get(owner.wall)!.frame,
    };
  };

  const belowContact = wallLevelContact(neighbors.below, "top");
  const aboveContact = wallLevelContact(neighbors.above, "bottom");
  bands.forEach((band, bandIndex) => {
    const previous = bands[bandIndex - 1]?.footprint ?? [];
    const next = bands[bandIndex + 1]?.footprint ?? [];
    let bottomSurface = previous[0]
      ? differenceClippingGeometry(band.footprint, previous)
      : band.footprint;
    let topSurface = next[0] ? differenceClippingGeometry(band.footprint, next) : band.footprint;
    if (band.bottom === 0 && belowContact.length)
      bottomSurface = differenceClippingGeometry(bottomSurface, belowContact);
    if (Math.abs(band.top - floor.floorToFloorHeightMeters) < EPSILON && aboveContact.length)
      topSurface = differenceClippingGeometry(topSurface, aboveContact);
    addHorizontalSurface(bottomSurface, band.bottom, false, band.activeWalls);
    addHorizontalSurface(topSurface, band.top, true, band.activeWalls);
    band.footprint.forEach((polygon) =>
      polygon.forEach((ring) => {
        for (let index = 0; index < ring.length - 1; index += 1) {
          const start = ring[index];
          const end = ring[index + 1];
          const delta: Horizontal = [end[0] - start[0], end[1] - start[1]];
          const lengthSquared = delta[0] ** 2 + delta[1] ** 2;
          // Union removes collinear wall boundaries, especially above openings.
          // Restore them before selecting a face owner and its finish.
          const splits = uniqueSorted([
            0,
            1,
            ...band.activeWalls.flatMap((wall) => {
              const frame = wallData.get(wall)!.frame;
              const direction = normalize(delta);
              if (
                Math.abs(direction[0] * frame.direction[0] + direction[1] * frame.direction[1]) <
                0.999
              )
                return [];
              return [frame.from, frame.to]
                .map(
                  (point) =>
                    ((point[0] - start[0]) * delta[0] + (point[1] - start[1]) * delta[1]) /
                    lengthSquared,
                )
                .filter((progress) => progress > EPSILON && progress < 1 - EPSILON);
            }),
          ]);
          for (let part = 0; part < splits.length - 1; part += 1) {
            const a: Horizontal = [
              start[0] + delta[0] * splits[part],
              start[1] + delta[1] * splits[part],
            ];
            const b: Horizontal = [
              start[0] + delta[0] * splits[part + 1],
              start[1] + delta[1] * splits[part + 1],
            ];
            const edge = [b[0] - a[0], b[1] - a[1]] as Horizontal;
            // polygon-clipping orients every ring with solid material on its left:
            // exterior contours are counter-clockwise and holes are clockwise.
            // Consequently the visible face is always on the ring's right. Flipping
            // hole-ring faces hid the upper interior wall band whenever door cuts
            // closed into a hole above their lintels, exposing the green ground.
            const candidate = normalize([edge[1], -edge[0]]);
            const center: Horizontal = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const planSample = worldPointToPlan(
              { x: center[0] + candidate[0] * 0.08, z: center[1] + candidate[1] * 0.08 },
              floor.coordinates,
            );
            const outside = !pointInsideFloorFootprint(planSample, floor);
            const face = wallFaceSurface(
              center,
              edge,
              candidate,
              band.activeWalls,
              outside,
              outside ? outsideColor : insideColor,
            );
            const fadeNormal = fadeNormalAt(center, band.activeWalls);
            const buffers = face.finish
              ? buffersFor(
                  fadeNormal,
                  `${fadeNormal?.join(":") ?? "interior"}:${JSON.stringify(face.finish)}`,
                )
              : buffersFor(fadeNormal);
            if (face.finish) buffers.finish = face.finish;
            const aBottom = [a[0], band.bottom, a[1]] as const;
            const bBottom = [b[0], band.bottom, b[1]] as const;
            const aTop = [a[0], band.top, a[1]] as const;
            const bTop = [b[0], band.top, b[1]] as const;
            addTriangle(buffers, aBottom, bTop, bBottom, face.color, face.frame);
            addTriangle(buffers, aBottom, aTop, bTop, face.color, face.frame);
          }
        }
      }),
    );
  });

  return [...buffersByDirection.values()].map((buffers) => {
    const geometry = new BufferGeometry();
    geometry.userData.preservePlanarFaces = true;
    geometry.setAttribute("position", new Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(buffers.colors, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(buffers.uvs, 2));
    geometry.setIndex(buffers.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const bounds = geometry.boundingBox;
    const center: Horizontal = bounds
      ? [(bounds.min.x + bounds.max.x) / 2, (bounds.min.z + bounds.max.z) / 2]
      : [0, 0];
    return {
      geometry,
      ...(buffers.finish ? { finish: buffers.finish } : {}),
      outwardNormal: buffers.outwardNormal,
      fadeNormals: buffers.fadeNormals,
      center,
    };
  });
}
export { JUNCTION_SEAM_OVERLAP_METERS } from "./architecture-geometry/architecture-geometry-contract";
export { buildContinuousWallGeometry } from "./architecture-geometry/continuous-wall-geometry";
export { roomInteriorAreaSquareMeters } from "./architecture-geometry/room-interior-area";
export {
  junctionArmHalfLength,
  wallExteriorNormal,
} from "./architecture-geometry/wall-coordinate-frame";
export {
  buildWallJunctionGeometries,
  junctionFadeNormal,
} from "./architecture-geometry/wall-junction-geometry";
export {
  junctionConnectorInterval,
  wallSolidFootprintPolygons,
} from "./architecture-geometry/wall-solid-footprints";
export type { ArchitecturalWallGeometryGroup } from "./architecture-geometry/wall-solid-footprints";
