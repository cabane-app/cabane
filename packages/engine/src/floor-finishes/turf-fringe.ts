import { BufferGeometry, Float32BufferAttribute } from "three";
import { planPointToWorld } from "../geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import type { TerrainSurface } from "../terrain/terrain-surface";
import type { FloorCoordinates } from "../types";
import type { GroundLawnEdge } from "./ground-lawn-edges";
import { turfGradeSampler } from "./turf-grade";

const looseFinishes = new Set([
  "pine-bark",
  "gravel",
  "pebbles",
  "sand",
  "light-dirt",
  "dark-dirt",
]);

// Split at changes of grade as well as at the stations used to shape the grass.
function addStation(stations: number[], distance: number, length: number) {
  if (
    distance > 0 &&
    distance < length &&
    !stations.some((at) => Math.abs(at - distance) < 0.0001)
  ) {
    stations.push(distance);
  }
}

export function createTurfFringe(
  edges: readonly GroundLawnEdge[],
  coordinates: FloorCoordinates,
  terrain: TerrainSurface,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    contact: number[] = [],
    colors: number[] = [],
    mask: number[] = [],
    indices: number[] = [];
  const runs = edges
    .map((edge) => {
      const [x, z] = planPointToWorld(edge.from, coordinates);
      const [endX, endZ] = planPointToWorld(edge.to, coordinates);
      const length = Math.hypot(endX - x, endZ - z);
      return { edge, x, z, endX, endZ, length };
    })
    .filter((run) => run.length > 0.012);
  if (!runs.length) return null;
  const heightAt = terrain ? turfGradeSampler(terrain) : null;
  const perimeter = runs.reduce((sum, run) => sum + run.length, 0);
  const spacing = Math.max(0.23, perimeter / 1800);
  for (const { edge, x, z, endX, endZ, length } of runs) {
    const dx = (endX - x) / length,
      dz = (endZ - z) / length;
    const [nx, nz] = edge.lawnNormal;
    const loose = edge.finish.kind === "preset" && looseFinishes.has(edge.finish.preset);
    const reach = loose ? 0.2 : 0.069;
    const phase = x * 1.73 + z * 2.37;
    const count = Math.max(2, Math.ceil(length / spacing));
    const stations = Array.from({ length: count + 1 }, (_, i) => (length * i) / count);
    if (terrain) {
      for (const gridX of terrain.gridX) addStation(stations, (gridX - x) / dx, length);
      for (const gridZ of terrain.gridZ) addStation(stations, (gridZ - z) / dz, length);
      stations.sort((a, b) => a - b);
    }
    const first = positions.length / 3;
    for (const [i, distance] of stations.entries()) {
      const patch =
        0.84 +
        0.32 * Math.sin(phase + distance * 3.1) +
        0.18 * Math.sin(phase * 0.6 - distance * 7.3);
      const taper = Math.min(1, distance / reach, (length - distance) / reach);
      for (const across of [0, 1]) {
        const offset = across ? -reach * patch * taper : 0.004;
        const px = x + distance * dx + nx * offset,
          pz = z + distance * dz + nz * offset;
        positions.push(px, GROUND_ELEVATION_METERS + 0.007 + (heightAt?.(px, pz) ?? 0), pz);
        // ExtrudeGeometry uses local XY coordinates on the top of the diorama.
        uvs.push(px, -pz);
        contact.push(px, pz);
        mask.push(phase + distance / 1.83, across);
        // Thatch shows through in patches where the dense lawn gives way to exposed runners.
        const thatch =
          across *
          (0.53 +
            0.31 * Math.sin(distance * 5.7 + phase) +
            0.15 * Math.cos(distance * 9.1 - phase));
        colors.push(1 - thatch * 0.21, 1 - thatch * 0.49, 1 - thatch * 0.53);
      }
      if (i + 1 === stations.length) continue;
      const a = first + 2 * i;
      if (dx * nz - dz * nx > 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  if (!indices.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv1", new Float32BufferAttribute(contact, 2));
  geometry.setAttribute("uv2", new Float32BufferAttribute(mask, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
