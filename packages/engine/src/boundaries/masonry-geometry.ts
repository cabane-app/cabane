import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";
import type { BoundaryDimensions } from "./BoundaryBeam";
import type { MasonryMiters } from "./masonry-miters";

type Point = [number, number, number];
const limestone = ["#b5aa96", "#b1a18d", "#a6a093", "#bcb39f", "#ada391", "#beb09a"];
const coping = ["#cbc1ac", "#d1c7b5", "#c8bca6"];
const mortar = new Color("#998e7c");

function grain(seed: number) {
  const wave = Math.sin(seed * 71.317 + 0.83) * 43758.5453;
  return wave - Math.floor(wave);
}

/** Through-stones with a short eased arris, coursed around an inset mortar core. */
export function masonryGeometry(
  { length, width, height }: BoundaryDimensions,
  miters: MasonryMiters = {},
) {
  const positions: number[] = [],
    colors: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const origin = new Vector3(),
    normal = new Vector3(),
    edge = new Vector3();
  const half = length / 2;
  const from = miters.from ?? 0,
    to = miters.to ?? 0;
  const reach = (slope: number) => Math.min(half, width * Math.max(1, Math.abs(slope)));
  const startReach = reach(from),
    endReach = reach(to);
  // Only taper the end stones. Both runs reach the same diagonal across
  // the coping, stone courses and inset mortar, including on a grade.
  function cutEnd([x, y, z]: Point): Point {
    const start = Math.max(0, 1 - (x + half) / startReach);
    const end = Math.max(0, 1 - (half - x) / endReach);
    return [x + z * (start * from + end * to), y, z];
  }
  // UVs stay inside a single photographed slab. The model supplies the actual
  // mortar lines. The core samples a single mineral tone between stones.
  let patch = { x: 0, y: 0, z: 0, u: 0.24, v: 0.28, scaleU: 0, scaleV: 0 };
  function faceNormal(points: Point[]) {
    origin.fromArray(points[0]);
    normal
      .fromArray(points[1])
      .sub(origin)
      .cross(edge.fromArray(points[2]).sub(origin))
      .normalize();
  }
  function face(points: Point[], color: Color) {
    const start = positions.length / 3;
    faceNormal(points);
    const nx = Math.abs(normal.x),
      ny = Math.abs(normal.y),
      nz = Math.abs(normal.z);
    const end = nx > ny && nx > nz,
      horizontal = ny > nx && ny > nz;
    const cut = from || to ? points.map(cutEnd) : points;
    if (cut !== points) faceNormal(cut);
    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = points[i];
      positions.push(...cut[i]);
      colors.push(color.r, color.g, color.b);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(
        patch.u + (end ? z - patch.z : x - patch.x) * patch.scaleU,
        patch.v + (horizontal ? z - patch.z : y - patch.y) * patch.scaleV,
      );
    }
    for (let i = 1; i < points.length - 1; i++) indices.push(start, start + i, start + i + 1);
  }

  const capHeight = Math.min(height * 0.18, 0.105);
  const bedTop = height - capHeight;
  const courses = Math.max(1, Math.round(bedTop / 0.225));
  const joint = Math.min(0.009, height * 0.035, width * 0.04, length * 0.04);
  const bodyDepth = width * 0.45;
  const coreLeft = miters.from === undefined ? -half + joint : -half,
    coreRight = miters.to === undefined ? half - joint : half,
    coreZ = bodyDepth - joint * 1.25;
  const base = joint * 0.4,
    top = height - joint;
  const near: Point[] = [
    [coreLeft, base, coreZ],
    [coreRight, base, coreZ],
    [coreRight, top, coreZ],
    [coreLeft, top, coreZ],
  ];
  const far: Point[] = near.map(([x, y]) => [x, y, -coreZ]);
  face(near, mortar);
  face([...far].reverse(), mortar);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    face([near[i], far[i], far[next], near[next]], mortar);
  }

  const weights = Array.from({ length: courses }, (_, row) => 0.88 + grain(row + 2) * 0.24);
  const total = weights.reduce((a, b) => a + b, 0);
  let bottom = 0;
  for (let row = 0; row <= courses; row++) {
    const cap = row === courses;
    const rowHeight = cap ? capHeight : (bedTop * weights[row]) / total;
    // Keep the model bounded even for an exceptionally long authored boundary.
    const pitch = Math.max(cap ? 0.82 : rowHeight * 2.65, (length * (courses + 1)) / 1500);
    let left = -half;
    for (let column = 0; left < half; column++) {
      const seed = row * 109 + column * 19 + 7;
      const split =
        left + pitch * (0.78 + grain(seed) * 0.49) * (column === 0 && row % 2 ? 0.5 : 1);
      const right = half - split < pitch * 0.36 ? half : split;
      const x0 = left + (column === 0 && miters.from === undefined ? 0 : joint * 0.5);
      const x1 = right - (right === half && miters.to === undefined ? 0 : joint * 0.5);
      const y0 = bottom + (row === 0 ? 0 : joint * 0.5);
      const y1 = cap ? height : bottom + rowHeight - joint * 0.5;
      const depth = cap ? width * 0.5 : bodyDepth - joint * 0.3 * grain(seed + 5);
      const bevel = Math.min(cap ? 0.008 : 0.006, (x1 - x0) * 0.06, (y1 - y0) * 0.08, depth * 0.08);
      const corners = Array.from(
        { length: 4 },
        (_, corner) => bevel * (cap ? 1 : 1.1 + grain(seed + corner + 1) * 1.9),
      );
      const ring = (inset: number, z: number): Point[] => {
        const a = x0 + inset,
          b = x1 - inset,
          c = y0 + inset,
          d = y1 - inset;
        return [
          [a + corners[0], c, z],
          [b - corners[1], c, z],
          [b, c + corners[1], z],
          [b, d - corners[2], z],
          [b - corners[2], d, z],
          [a + corners[3], d, z],
          [a, d - corners[3], z],
          [a, c + corners[0], z],
        ];
      };
      const front = ring(bevel, depth),
        frontShoulder = ring(0, depth - bevel);
      const back = ring(bevel, -depth),
        backShoulder = ring(0, -depth + bevel);
      const palette = cap ? coping : limestone;
      const tone = new Color(palette[Math.floor(grain(seed + 13) * palette.length)]);
      // Match grain density across ordinary blocks and keep oversized coping
      // inside one slab. Each stone exposes a different part and orientation.
      const span = Math.max(x1 - x0, y1 - y0, depth * 2);
      const scale = Math.min(0.55, 0.38 / span);
      const reach = span * scale;
      const offset = (tile: number, shift: number) =>
        Math.floor(grain(tile) * 2) * 0.5 + 0.025 + grain(shift) * (0.45 - reach);
      const flippedU = grain(seed + 23) > 0.5,
        flippedV = grain(seed + 29) > 0.5;
      patch = {
        x: x0,
        y: y0,
        z: -depth,
        u: offset(seed + 11, seed + 21) + (flippedU ? reach : 0),
        v: offset(seed + 17, seed + 27) + (flippedV ? reach : 0),
        scaleU: flippedU ? -scale : scale,
        scaleV: flippedV ? -scale : scale,
      };
      face(front, tone);
      face([...back].reverse(), tone);
      for (let i = 0; i < 8; i++) {
        const next = (i + 1) % 8;
        face([front[i], frontShoulder[i], frontShoulder[next], front[next]], tone);
        face([frontShoulder[i], backShoulder[i], backShoulder[next], frontShoulder[next]], tone);
        face([backShoulder[i], back[i], back[next], backShoulder[next]], tone);
      }
      left = right;
    }
    bottom += rowHeight;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.preservePlanarFaces = true;
  return geometry;
}
