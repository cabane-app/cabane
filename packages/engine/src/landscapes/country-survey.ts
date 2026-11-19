import { PlaneGeometry, type Texture } from "three";
import type { TerrainSurface } from "../terrain/terrain-surface";

export interface FieldPlot {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  surveyX: number;
  surveyZ: number;
  surveyScale: number;
  groundColor: string;
  plantingLot: { centerX: number; centerZ: number; width: number; depth: number };
  terrain: TerrainSurface | null;
}

function distanceToLawn(plot: FieldPlot, x: number, z: number) {
  const dx = Math.abs(x - plot.x) - plot.width / 2,
    dz = Math.abs(z - plot.z) - plot.depth / 2;
  return Math.max(dx, dz);
}

function groundHeight(plot: FieldPlot, x: number, z: number, surveyHeight: number) {
  const t = Math.min(
    1,
    Math.max(0, distanceToLawn(plot, x, z) / Math.max(12, plot.surveyScale * 17)),
  );
  const grade = plot.terrain?.offsetAt(x, z) ?? 0;
  return grade + (surveyHeight * plot.surveyScale - grade) * t * t * (3 - 2 * t);
}

export function surveyGeometry(plot: FieldPlot, raster: Texture, distant: boolean) {
  const source = raster.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const side = distant ? 1536 : 384,
    steps = distant ? 128 : 192;
  const geometry = new PlaneGeometry(
    side * plot.surveyScale,
    side * plot.surveyScale,
    steps,
    steps,
  ).rotateX(-Math.PI / 2);
  const points = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < points.count; i++) {
    const col = Math.round(uv.getX(i) * (source.width - 1));
    const row = Math.round((1 - uv.getY(i)) * (source.height - 1));
    const p = (row * source.width + col) * 4;
    const x = plot.surveyX + points.getX(i),
      z = plot.surveyZ + points.getZ(i);
    // Close foliage stands on bare earth. The distant tile carries a low-pass canopy surface.
    const altitude = distant
      ? (pixels[p] / 255) * 110 + 100 + (pixels[p + 1] / 255) * 35
      : (pixels[p] / 255) * 20 + 132;
    points.setY(i, groundHeight(plot, x, z, altitude - 140.09) - (distant ? 0.2 : 0));
  }
  if (distant) {
    const indices = geometry.index!,
      kept: number[] = [];
    // Both grids have vertices exactly at ±192 m. Leave a hole for the detailed survey.
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i),
        b = indices.getX(i + 1),
        c = indices.getX(i + 2);
      const x = (points.getX(a) + points.getX(b) + points.getX(c)) / 3;
      const z = (points.getZ(a) + points.getZ(b) + points.getZ(c)) / 3;
      if (Math.max(Math.abs(x), Math.abs(z)) >= 192 * plot.surveyScale) kept.push(a, b, c);
    }
    geometry.setIndex(kept);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Keep metre-accurate depth at the home. Fit distant hills into the last part of
// the active camera's depth range without moving their screen positions.
export const countryDepth = /* glsl */ `
float countryFar = projectionMatrix[3][3] > 0.5
  ? (projectionMatrix[3][2]-1.)/projectionMatrix[2][2]
  : projectionMatrix[3][2]/(projectionMatrix[2][2]+1.);
float distanceToEye = -mvPosition.z;
if(distanceToEye>countryFar*.68) {
  float band = countryFar*.31;
  float d = countryFar*.68 + band*(1.-exp(-(distanceToEye-countryFar*.68)/band));
  vec4 mapped=projectionMatrix*vec4(0.,0.,-d,1.);
  gl_Position.z=gl_Position.w*mapped.z/mapped.w;
}`;

// Sample the rendered triangles, including the flattened ground beside the lot.
export function meshHeightAt(grid: PlaneGeometry, x: number, z: number) {
  const { width, height, widthSegments: cols, heightSegments: rows } = grid.parameters;
  const u = Math.min(cols, Math.max(0, (x / width + 0.5) * cols));
  const v = Math.min(rows, Math.max(0, (z / height + 0.5) * rows));
  const i = Math.min(cols - 1, Math.floor(u)),
    j = Math.min(rows - 1, Math.floor(v)),
    tx = u - i,
    tz = v - j;
  const pos = grid.getAttribute("position"),
    a = j * (cols + 1) + i,
    b = a + cols + 1;
  if (tx + tz <= 1) return pos.getY(a) * (1 - tx - tz) + pos.getY(a + 1) * tx + pos.getY(b) * tz;
  return pos.getY(b + 1) * (tx + tz - 1) + pos.getY(a + 1) * (1 - tz) + pos.getY(b) * (1 - tx);
}
