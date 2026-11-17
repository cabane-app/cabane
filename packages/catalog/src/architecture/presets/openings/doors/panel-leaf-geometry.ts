import { BufferGeometry, Float32BufferAttribute } from "three";

type Point = [number, number, number];
type Rect = [number, number, number, number];

/** Two floating fields set into rails and stiles, moulded on both faces of a 50 mm leaf. */
export function panelLeafGeometry(width: number, height: number) {
  const x = width / 2,
    y = height / 2,
    face = 0.025;
  const stile = Math.min(0.104, width * 0.16);
  const bottom = Math.min(0.184, height * 0.105),
    top = Math.min(0.113, height * 0.075);
  const rail = Math.min(0.147, height * 0.085),
    middle = -y + height * 0.435;
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  function quad(points: Point[], tint: number, across: boolean, grainOffset = 0) {
    const start = positions.length / 3;
    for (const [px, py, pz] of points) {
      positions.push(px, py, pz);
      uvs.push((across ? py : px) / 0.86 + grainOffset, (across ? px : py) / 1.86);
      colors.push(tint, tint, tint);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const corners = ([x0, y0, x1, y1]: Rect, z: number): Point[] => [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
  const outer: Rect = [-x, -y, x, y];
  const bevel = Math.min(0.0025, stile / 8);
  const front = corners(outer, face - bevel),
    back = corners(outer, -face + bevel);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad([back[i], back[j], front[j], front[i]], 0.91, i % 2 === 0);
  }
  for (const side of [1, -1]) {
    function surface(points: Point[], tint: number, across = false, offset = 0) {
      quad(side === 1 ? points : points.reverse(), tint, across, offset);
    }
    const z = face * side,
      left = -x + stile,
      right = x - stile;
    const edge = side === 1 ? front : back;
    const rim = corners([-x + bevel, -y + bevel, x - bevel, y - bevel], z);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      surface([edge[i], edge[j], rim[j], rim[i]], 0.81, i % 2 === 0);
    }
    surface(corners([-x + bevel, -y + bevel, left, y - bevel], z), 1, false, 0.18);
    surface(corners([right, -y + bevel, x - bevel, y - bevel], z), 1, false, 0.59);
    surface(corners([left, -y + bevel, right, -y + bottom], z), 0.97, true);
    surface(corners([left, y - top, right, y - bevel], z), 0.97, true, 0.24);
    surface(corners([left, middle - rail / 2, right, middle + rail / 2], z), 0.97, true, 0.56);
    for (const [low, high] of [
      [-y + bottom, middle - rail / 2],
      [middle + rail / 2, y - top],
    ]) {
      const mould = Math.min(0.035, (right - left) * 0.15, (high - low) * 0.14);
      let previous = corners([left, low, right, high], z);
      // The small rebate catches light before the bevel steps down to the field.
      for (const [inset, depth, tint] of [
        [0.075, 0.002, 0.71],
        [0.16, 0.002, 0.94],
        [0.32, 0.004, 0.91],
        [0.7, 0.01, 0.97],
        [0.81, 0.011, 0.78],
        [1, 0.011, 0.94],
      ]) {
        const m = mould * inset;
        const inner = corners([left + m, low + m, right - m, high - m], (face - depth) * side);
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          surface([previous[i], previous[j], inner[j], inner[i]], tint, i % 2 === 0);
        }
        previous = inner;
      }
      surface(previous, 0.94, false, 0.37);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.preservePlanarFaces = true;
  return geometry;
}
