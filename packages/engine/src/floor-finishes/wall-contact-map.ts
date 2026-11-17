import {
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  RedFormat,
  type BufferGeometry,
} from "three";
import { wallFrame } from "../architecture-geometry/wall-coordinate-frame";
import { worldBoundsForPolygon } from "../geometry";
import type { FloorSpec } from "../types";

/** Indirect light falls off at the foot of walls, including those behind the camera. */
export function createWallContactMap(floor: FloorSpec) {
  const walls = floor.walls.filter((wall) => !wall.virtual);
  if (!walls.length) return null;
  const bounds = worldBoundsForPolygon(
    walls.flatMap((wall) => [wall.from, wall.to]),
    floor.coordinates,
  );
  const reach = 0.75;
  const padding = reach + Math.max(...walls.map((wall) => wall.thicknessMeters)) / 2;
  const spanX = bounds.width + 2 * padding,
    spanZ = bounds.depth + 2 * padding;
  const density = Math.min(24, 512 / Math.max(spanX, spanZ));
  const width = Math.ceil(spanX * density),
    height = Math.ceil(spanZ * density);
  const minX = bounds.minX - padding,
    minZ = bounds.minZ - padding;
  const pixels = new Uint8Array(width * height).fill(255);
  for (const wall of walls) {
    const { from, direction, length } = wallFrame(wall, floor);
    const half = wall.thicknessMeters / 2;
    const radius = half + reach;
    const strength = Math.min(1, (wall.heightMeters ?? floor.defaultWallHeightMeters) / 1.3);
    function shade(start: number, end: number) {
      if (end <= start) return;
      const ax = from[0] + direction[0] * start,
        az = from[1] + direction[1] * start;
      const bx = from[0] + direction[0] * end,
        bz = from[1] + direction[1] * end;
      // Keep a white border: the surrounding grounds can extend beyond the atlas.
      const x0 = Math.max(1, Math.floor((Math.min(ax, bx) - radius - minX) * density));
      const z0 = Math.max(1, Math.floor((Math.min(az, bz) - radius - minZ) * density));
      const x1 = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + radius - minX) * density));
      const z1 = Math.min(height - 1, Math.ceil((Math.max(az, bz) + radius - minZ) * density));
      for (let z = z0; z < z1; z++) {
        const dz = minZ + (z + 0.5) / density - az;
        for (let x = x0; x < x1; x++) {
          const dx = minX + (x + 0.5) / density - ax;
          const along = Math.max(0, Math.min(end - start, dx * direction[0] + dz * direction[1]));
          const dist = Math.hypot(dx - along * direction[0], dz - along * direction[1]);
          const falloff = Math.min(1, Math.max(0, (radius - dist) / reach));
          const index = z * width + x;
          pixels[index] = Math.min(
            pixels[index],
            Math.round(255 - 155 * falloff * falloff * strength),
          );
        }
      }
    }
    // Low-sill openings admit light between the jambs, including full-height glass.
    const cuts = floor.openings
      .filter((opening) => opening.wallId === wall.id && opening.sillHeightMeters < 0.12)
      .sort((a, b) => a.offsetFromWallStartPlanUnits - b.offsetFromWallStartPlanUnits);
    let cursor = 0;
    for (const cut of cuts) {
      const scale = floor.coordinates.metersPerPlanUnit;
      shade(cursor, Math.min(length, cut.offsetFromWallStartPlanUnits * scale));
      cursor = Math.max(cursor, (cut.offsetFromWallStartPlanUnits + cut.widthPlanUnits) * scale);
    }
    shade(cursor, length);
  }
  const map = new DataTexture(pixels, width, height, RedFormat);
  map.channel = 1;
  map.magFilter = map.minFilter = LinearFilter;
  map.repeat.set(density / width, density / height);
  map.offset.set(-minX * map.repeat.x, -minZ * map.repeat.y);
  map.needsUpdate = true;
  return map;
}

/** Flat finish and terrain meshes use a local XY shape rotated onto the XZ floor. */
export function setWallContactUVs(geometry: BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uv[i * 2] = positions.getX(i);
    uv[i * 2 + 1] = -positions.getY(i);
  }
  geometry.setAttribute("uv1", new Float32BufferAttribute(uv, 2));
}
