import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { polygonSignedArea } from "../geometry";
import type { FloorCoordinates, PoolSpec } from "../types";
import {
  bufferedPoolFootprint,
  POOL_GROUND_Y,
  poolVerticalLayout,
  poolWorldRing,
} from "./pool-footprint";

const WALL_THICKNESS = 0.13;
const BOARD_COLORS = ["#b7803f", "#bc8746", "#b17a3a", "#c18c4b", "#b98341"];

/** One exterior skin: board seams subdivide faces rather than stacking shells on the liner. */
export function poolTimberGeometry(pool: PoolSpec, coordinates: FloorCoordinates) {
  const { rim } = poolVerticalLayout(pool);
  const bottom = POOL_GROUND_Y + 0.012;
  const top = rim - 0.012;
  const count = Math.max(1, Math.round((top - bottom) / 0.145));
  const boardHeight = (top - bottom) / count;
  const positions: number[] = [];
  const colors: number[] = [];
  for (const polygon of bufferedPoolFootprint(pool.polygon, coordinates, WALL_THICKNESS)) {
    // The buffer's holes are exterior walls too when narrow concave inlets close.
    for (const ring of polygon) {
      for (let edge = 0; edge < ring.length - 1; edge++) {
        const [x, z] = ring[edge];
        const [tx, tz] = ring[edge + 1];
        for (let course = 0; course < count; course++) {
          const low = bottom + course * boardHeight;
          const bands = [low, low + 0.005, low + boardHeight];
          for (let band = 0; band < 2; band++) {
            const a = bands[band],
              b = bands[band + 1];
            positions.push(x, a, z, x, b, z, tx, b, tz, x, a, z, tx, b, tz, tx, a, tz);
            const color = new Color(
              band === 0 ? "#80572f" : BOARD_COLORS[course % BOARD_COLORS.length],
            );
            for (let vertex = 0; vertex < 6; vertex++) colors.push(color.r, color.g, color.b);
          }
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Uprights sit outside the wall but inside the coping's 25 cm footprint. */
export function poolTimberBraces(pool: PoolSpec, coordinates: FloorCoordinates) {
  const ring = poolWorldRing(pool.polygon, coordinates);
  const winding = polygonSignedArea(ring) > 0 ? 1 : -1;
  return ring.flatMap(([x, z], index) => {
    const [tx, tz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(tx - x, tz - z);
    const nx = (winding * (tz - z)) / length;
    const nz = (-winding * (tx - x)) / length;
    const [px, pz] = ring[(index + ring.length - 1) % ring.length];
    const before = Math.hypot(x - px, z - pz);
    const bx = (winding * (z - pz)) / before + nx;
    const bz = (-winding * (x - px)) / before + nz;
    const cornerScale = 0.16 / Math.hypot(bx, bz);
    const count = Math.ceil(length / 1.15);
    return [
      { x: x + bx * cornerScale, z: z + bz * cornerScale, angle: Math.atan2(bx, bz) },
      ...Array.from({ length: count - 1 }, (_, i) => ({
        x: x + ((tx - x) * (i + 1)) / count + nx * 0.16,
        z: z + ((tz - z) * (i + 1)) / count + nz * 0.16,
        angle: -Math.atan2(tz - z, tx - x),
      })),
    ];
  });
}
