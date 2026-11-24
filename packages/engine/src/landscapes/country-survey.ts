import type { Texture } from "three";
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
  const lot = plot.plantingLot;
  const dx = Math.abs(x - lot.centerX) - lot.width / 2,
    dz = Math.abs(z - lot.centerZ) - lot.depth / 2;
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

export function surveyGrade(plot: FieldPlot, raster: Texture | null | undefined) {
  if (!raster)
    return (x: number, z: number) => groundHeight(plot, plot.surveyX + x, plot.surveyZ + z, 0);
  const source = raster.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const size = 384 * plot.surveyScale;
  const { width, height } = canvas;
  const red = (x: number, z: number) => pixels[4 * (z * width + x)];
  return (x: number, z: number) => {
    const u = Math.min(width - 1, Math.max(0, (0.5 + x / size) * (width - 1)));
    const v = Math.min(height - 1, Math.max(0, (0.5 + z / size) * (height - 1)));
    const i = Math.floor(u),
      j = Math.floor(v),
      k = Math.ceil(u),
      l = Math.ceil(v);
    const top = red(i, j) + (red(k, j) - red(i, j)) * (u - i);
    const bottom = red(i, l) + (red(k, l) - red(i, l)) * (u - i);
    return groundHeight(
      plot,
      plot.surveyX + x,
      plot.surveyZ + z,
      ((top + (bottom - top) * (v - j)) * 20) / 255 - 8.09,
    );
  };
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
