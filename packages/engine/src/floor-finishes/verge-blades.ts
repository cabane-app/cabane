import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { planPointToWorld } from "../geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import type { TerrainSurface } from "../terrain/terrain-surface";
import { DEFAULT_TERRAIN_GRASS_COLOR } from "../terrain/terrain-settings";
import type { FloorCoordinates } from "../types";
import type { GroundLawnEdge } from "./ground-lawn-edges";
import { patternRandom } from "./periodic-motifs";

type Batch = { positions: number[]; colors: number[]; indices: number[] };
type Random = () => number;
type HeightAt = (x: number, z: number) => number;

function vertex(batch: Batch, x: number, y: number, z: number, color: Color, light: number) {
  batch.positions.push(x, y, z);
  batch.colors.push(color.r * light, color.g * light, color.b * light);
}

function addBlade(
  batch: Batch,
  x: number,
  y: number,
  z: number,
  angle: number,
  height: number,
  color: Color,
  random: Random,
) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const halfWidth = height * (0.052 + random() * 0.055);
  const reach = height * (0.35 + random() * 0.94);
  const i = batch.positions.length / 3;
  const wx = dz * halfWidth;
  const wz = -dx * halfWidth;
  vertex(batch, x - wx, y, z - wz, color, 0.59);
  vertex(batch, x + wx, y, z + wz, color, 0.65);
  const bendX = x + dx * reach * 0.27;
  const bendZ = z + dz * reach * 0.27;
  vertex(batch, bendX - wx * 0.65, y + height * 0.68, bendZ - wz * 0.65, color, 0.86);
  vertex(batch, bendX + wx * 0.65, y + height * 0.68, bendZ + wz * 0.65, color, 0.94);
  vertex(batch, x + dx * reach, y + height, z + dz * reach, color, 1.08);
  batch.indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3, i + 2, i + 4, i + 3);
}

const soilHeight = (x: number, z: number, terrain: TerrainSurface) =>
  GROUND_ELEVATION_METERS + (terrain?.offsetAt(x, z) ?? 0);

// Split pine bark has both dark rind and warm exposed fibres, as in the bed scan.
const barkFlakes = ["#895b3c", "#a66e44", "#bf895c"].map((hex) => new Color(hex));
const gravel = new Color("#a29c89");

// A few chips spill out of loose beds. Each perimeter meets the actual grade.
function addChip(
  batch: Batch,
  x: number,
  z: number,
  isBark: boolean,
  heightAt: HeightAt,
  random: Random,
) {
  const length = (isBark ? 0.0105 : 0.011) * (0.65 + random());
  const width = length * (isBark ? 0.36 : 0.76);
  const a = random() * Math.PI;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const weathering = random();
  const color = isBark ? barkFlakes[Math.floor(weathering * barkFlakes.length)] : gravel;
  const shade = 0.85 + weathering * 0.25;
  const center = batch.positions.length / 3;
  vertex(batch, x, heightAt(x, z) + length * (isBark ? 0.2 : 0.5) + 0.003, z, color, shade);
  for (let j = 0; j < 5; j++) {
    const theta = (j * Math.PI * 2) / 5;
    const u = Math.cos(theta) * length * (0.76 + random() * 0.32);
    const v = Math.sin(theta) * width;
    const px = x + u * cs - v * sn;
    const pz = z + u * sn + v * cs;
    vertex(batch, px, heightAt(px, pz) + 0.001, pz, color, shade * (0.75 + 0.18 * (j % 2)));
    batch.indices.push(center, center + 1 + ((j + 1) % 5), center + 1 + j);
  }
}

function edgeSeed(x: number, z: number, dx: number, dz: number) {
  const mix = Math.imul(Math.round(x * 1000), 73856093) ^ Math.imul(Math.round(z * 1000), 19349663);
  return (
    1 +
    (((mix ^ Math.imul(Math.round(dx * 1000), 83492791) ^ Math.round(dz * 1000)) >>> 0) %
      2147483646)
  );
}

/** Sparse, static detail at foot level. Triangle cost is bounded across the whole floor. */
export function createVergeBlades(
  edges: readonly GroundLawnEdge[],
  coordinates: FloorCoordinates,
  groundColor: string,
  terrain: TerrainSurface,
): BufferGeometry | null {
  const runs = edges
    .map((edge) => {
      const [x, z] = planPointToWorld(edge.from, coordinates);
      const [endX, endZ] = planPointToWorld(edge.to, coordinates);
      const dx = endX - x;
      const dz = endZ - z;
      return { edge, x, z, dx, dz, length: Math.hypot(dx, dz) };
    })
    .filter((run) => run.length > 0.08);
  const total = runs.reduce((sum, run) => sum + run.length, 0);
  const spacing = Math.max(0.39, total / 192);
  const grass = new Color(groundColor);
  const zoneGrass = new Color(DEFAULT_TERRAIN_GRASS_COLOR);
  const tuftColor = new Color();
  const batch: Batch = { positions: [], colors: [], indices: [] };
  // Carry partial spacing over the next span even when a clipped edge is very short.
  let remainder = 0.5;
  for (const { edge, x, z, dx, dz, length } of runs) {
    const allocation = remainder + length / spacing;
    const count = Math.floor(allocation);
    remainder = allocation - count;
    const random = patternRandom(edgeSeed(x, z, dx, dz));
    const [nx, nz] = edge.lawnNormal;
    const preset = edge.finish.kind === "preset" ? edge.finish.preset : null;
    const isBark = preset === "pine-bark";
    const looseStone = preset === "gravel" || preset === "pebbles";
    const heightAt: HeightAt = (px, pz) =>
      edge.lawnPlatform ? 0.002 : soilHeight(px, pz, terrain) + (edge.explicitGrass ? 0.006 : 0);
    for (let j = 0; j < count; j++) {
      const fraction = (j + 0.13 + random() * 0.74) / count;
      const lane = 0.006 + Math.pow(random(), 2) * 0.13;
      const patchX = x + dx * fraction;
      const patchZ = z + dz * fraction;
      // Flush platform tops are rigid while the adjacent terrain can fall away beneath them.
      if (edge.platform || edge.lawnPlatform) {
        const finishY = edge.platform ? 0.002 : soilHeight(patchX, patchZ, terrain) + 0.006;
        if (Math.abs(heightAt(patchX, patchZ) - finishY) > 0.075) continue;
      }
      const rootX = patchX + nx * lane;
      const rootZ = patchZ + nz * lane;
      const height = (edge.platform ? 0.035 : 0.024) + random() * 0.029;
      const phase = random() * Math.PI * 2;
      const blades = 3 + Math.floor(random() * 5);
      tuftColor.copy(edge.explicitGrass ? zoneGrass : grass).multiplyScalar(0.72 + random() * 0.32);
      tuftColor.b *= 0.85;
      for (let i = 0; i < blades; i++) {
        const angle = phase + i * 2.4 + random() * 0.6;
        const px = rootX + Math.cos(angle) * random() * 0.016;
        const pz = rootZ + Math.sin(angle) * random() * 0.016;
        addBlade(
          batch,
          px,
          heightAt(px, pz) - 0.001,
          pz,
          angle,
          height * (0.65 + random() * 0.48),
          tuftColor,
          random,
        );
      }
      if (!edge.platform && !edge.lawnPlatform && (isBark || looseStone) && random() < 0.74) {
        const chips = 1 + Math.floor(random() * 2);
        for (let i = 0; i < chips; i++) {
          const spill = isBark ? -0.05 + random() * 0.063 : 0.002 + random() * 0.048;
          const along = (random() - 0.5) * 0.071;
          addChip(
            batch,
            patchX + nx * spill - nz * along,
            patchZ + nz * spill + nx * along,
            isBark,
            heightAt,
            random,
          );
        }
      }
    }
  }
  if (!batch.indices.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(batch.positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(batch.colors, 3));
  geometry.setIndex(batch.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
