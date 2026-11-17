import { BufferGeometry, Float32BufferAttribute } from "three";

/** Solid lobes keep the climbing silhouette while an atlas is loading or unavailable. */
function solidLeaf(young: boolean) {
  const rim = [
    [0, 0.045],
    [-0.22, -0.05],
    [-0.4, 0.035],
    [-0.29, 0.19],
    [-0.46, 0.32],
    [-0.51, 0.5],
    [-0.23, 0.46],
    [-0.14, 0.7],
    [0.02, 0.96],
    [0.16, 0.72],
    [0.24, 0.48],
    [0.51, 0.5],
    [0.43, 0.29],
    [0.3, 0.18],
    [0.4, 0.04],
    [0.21, -0.05],
  ] as const;
  const positions = [0, 0.32, 0.08];
  const indices: number[] = [];
  for (const [i, [x, y]] of rim.entries()) {
    positions.push(x * (young ? 0.74 : 1), y, -0.075 * y * y);
    indices.push(0, 1 + ((i + 1) % rim.length), 1 + i);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The atlas supplies the palmate outline and veins; eight facets cup the blade
 * along its midrib and tip. Both ages fit the same opaque alpha-tested pass. */
export function ivyLeaf(young: boolean, mapped: boolean) {
  if (!mapped) return solidLeaf(young);
  const rows = [
    { y: -0.11, half: 0.54, edge: 0.015, rib: 0.055 },
    { y: 0.54, half: 0.57, edge: -0.055, rib: 0.093 },
    { y: 1.01, half: 0.12, edge: -0.105, rib: -0.08 },
  ];
  const positions: number[] = [],
    uvs: number[] = [];
  for (const { y, half, edge, rib } of rows)
    for (const x of [-half, 0, half]) {
      positions.push(
        x * (young ? 0.84 : 1),
        y,
        (x === 0 ? rib : edge) - (young ? y * y * 0.08 : 0),
      );
      uvs.push(((young ? 1 : 0) + 0.5 + x / 1.28) / 2, (y + 0.16) / 1.2);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 7, 3, 7, 6, 4, 5, 8, 4, 8, 7]);
  geometry.computeVertexNormals();
  return geometry;
}
