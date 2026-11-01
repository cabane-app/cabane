import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
} from "three";

const BEVEL = 0.004;
export const COUNTERTOP_THICKNESS = 0.04;

/** One continuous slab, including the concave elbow, with no internal joint faces. */
export function countertopGeometry(width: number, depth: number, corner: boolean) {
  const x = width / 2 - BEVEL;
  const y = depth / 2 - BEVEL;
  const points = corner
    ? [
        [-x, -y],
        [x, -y],
        [x, -BEVEL],
        [-BEVEL, -BEVEL],
        [-BEVEL, y],
        [-x, y],
      ]
    : [
        [-x, -y],
        [x, -y],
        [x, y],
        [-x, y],
      ];
  const shape = new Shape();
  points.forEach(([px, py], index) => (index ? shape.lineTo(px, py) : shape.moveTo(px, py)));
  shape.closePath();
  const body = new ExtrudeGeometry(shape, {
    depth: COUNTERTOP_THICKNESS - 2 * BEVEL,
    bevelEnabled: true,
    bevelSize: BEVEL,
    bevelThickness: BEVEL,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 1,
  });
  // The flat top belongs to the LayeredSurface stack. Retain the bottom and
  // bevels here, removing the upper cap so it cannot compete with that finish.
  const positions = body.getAttribute("position");
  const normals = body.getAttribute("normal");
  const indices = [];
  for (let i = 0; i < positions.count; i += 3) {
    if ([i, i + 1, i + 2].every((vertex) => normals.getZ(vertex) > 0.999)) continue;
    indices.push(i, i + 1, i + 2);
  }
  body.clearGroups();
  body.setIndex(indices);
  body.translate(0, 0, BEVEL);
  return { body, top: new ShapeGeometry(shape) };
}

/** Sparse grain, stone veins or mineral flecks clipped inside the beveled top. */
export function countertopPattern(width: number, depth: number, corner: boolean, pattern: string) {
  const vertices: number[] = [];
  const margin = BEVEL + 0.003;
  const inside = (x: number, y: number) =>
    Math.abs(x) < width / 2 - margin &&
    Math.abs(y) < depth / 2 - margin &&
    (!corner || x < -margin || y < -margin);
  const triangle = (points: number[][]) => {
    if (!points.every(([x, y]) => inside(x, y))) return;
    if (corner && !points.every(([x]) => x < -margin) && !points.every(([, y]) => y < -margin))
      return;
    points.forEach(([x, y]) => vertices.push(x, y, 0));
  };
  const ribbon = (
    offset: number,
    slope: number,
    amplitude: number,
    thickness: number,
    phase: number,
  ) => {
    const point = (step: number, side: number) => {
      const x = -width / 2 + (width * step) / 60;
      return [x, offset + slope * x + amplitude * Math.sin(x * 8 + phase) + side * thickness];
    };
    for (let i = 0; i < 60; i++) {
      const a = point(i, -1),
        b = point(i + 1, -1),
        c = point(i + 1, 1),
        d = point(i, 1);
      triangle([a, b, c]);
      triangle([a, c, d]);
    }
  };
  if (pattern === "grain") {
    for (let row = 0; row < 12; row++) {
      const offset = depth * ((row + 0.5) / 12 - 0.5);
      ribbon(offset, 0, 0.003, 0.0005 + (row % 3) * 0.0002, row * 1.7);
    }
  } else if (pattern === "veins") {
    for (let row = -2; row <= 2; row++) {
      const offset = row * depth * 0.32;
      ribbon(offset, 0.36, 0.025, 0.0015, row * 2.3);
      ribbon(offset + 0.012, 0.36, 0.025, 0.0004, row * 2.3);
    }
  } else {
    // Jittered cells keep the mineral chips disjoint and deterministic.
    for (let column = 0; column < 24; column++) {
      for (let row = 0; row < 12; row++) {
        const seed = column * 17 + row * 31;
        const x = width * ((column + 0.5 + 0.2 * Math.sin(seed)) / 24 - 0.5);
        const y = depth * ((row + 0.5 + 0.2 * Math.cos(seed)) / 12 - 0.5);
        const radius = 0.001 + 0.0015 * (0.5 + 0.5 * Math.sin(seed * 3));
        triangle([
          [x - radius, y - radius],
          [x + radius, y],
          [x, y + radius],
        ]);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
