import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";

// The low boughs flank the leader at different heights and preserve windows through the crown.
const boughTips = [
  [-0.82, 2.75, 0.16, 0.54],
  [0.78, 2.94, 0.22, 0.57],
  [0.1, 2.8, 0.72, 0.55],
  [-0.35, 3.14, -0.71, 0.59],
  [-0.08, 3.16, -0.07, 0.71],
  [0.02, 3.65, 0, 0.54],
  [-0.57, 2.12, 0.12, 0.45],
  [0.32, 2.16, 0.12, 0.4],
];

const outline = [
  [0, 0, 0],
  [0.15, -0.73, 0.05],
  [0.38, -1, 0.09],
  [0.7, -0.71, 0.05],
  [1, 0, -0.12],
  [0.69, 0.75, 0.05],
  [0.37, 1, 0.09],
  [0.15, 0.72, 0.05],
] as const;

export function createDeciduousCrownGeometry() {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const shade = new Color("#487b45"),
    sun = new Color("#92b65c"),
    twig = new Color("#886b43");
  const vertex = (point: Vector3, color: Color) => {
    positions.push(...point.toArray());
    colors.push(...color.toArray());
  };
  for (const [bough, [x, y, z, reach]] of boughTips.entries()) {
    const origin = new Vector3(x, y, z);
    const tone = shade.clone().lerp(sun, 0.12 + (y - 2) * 0.27);
    for (let spray = 0; spray < 6; spray++) {
      const angle = spray * 2.399963 + bough * 0.86;
      const radial = new Vector3(Math.cos(angle), 0, Math.sin(angle)),
        across = new Vector3(-radial.z, 0, radial.x);
      const height = 0.05 + 0.36 * (spray / 5) + 0.07 * Math.sin(bough + spray);
      const along = (t: number) => {
        const node = origin
          .clone()
          .addScaledVector(radial, t * reach * (0.85 + 0.13 * Math.cos(spray)));
        node.y += t * height + 0.1 * Math.sin(t * Math.PI);
        return node;
      };
      const branch = positions.length / 3;
      for (const t of [0, 0.55, 1]) {
        const node = along(t),
          radius = 0.016 - 0.012 * t;
        vertex(node.clone().addScaledVector(across, radius), twig);
        vertex(node.clone().add(new Vector3(0, radius, 0)), twig);
        vertex(node.clone().addScaledVector(across, -radius), twig);
      }
      for (let j = 0; j < 2; j++)
        for (let k = 0; k < 3; k++) {
          const a = branch + j * 3 + k,
            b = branch + j * 3 + ((k + 1) % 3);
          indices.push(a, b, a + 3, b, b + 3, a + 3);
        }
      for (let leaf = 0; leaf < 9; leaf++) {
        const t = 0.16 + leaf * 0.103,
          start = along(t);
        const turn =
          leaf === 8 ? 0 : (leaf % 2 === 0 ? -1 : 1) * (0.9 + 0.22 * Math.sin(spray + leaf));
        const length = 0.25 + 0.043 * Math.cos(spray + leaf * 2 + bough);
        const axis = new Vector3(
          Math.cos(angle + turn) * length,
          0.055 + 0.09 * Math.sin(leaf * 2 + spray),
          Math.sin(angle + turn) * length,
        );
        const side = new Vector3(-axis.z, 0, axis.x)
          .normalize()
          .applyAxisAngle(axis.clone().normalize(), 0.36 * Math.sin(leaf + bough));
        const width = length * (0.36 + 0.04 * Math.cos(leaf));
        const color = tone.clone().lerp(sun, 0.075 + 0.03 * leaf);
        const base = positions.length / 3;
        const mid = start.clone().addScaledVector(axis, 0.46);
        mid.y += length * 0.2;
        vertex(mid, color);
        for (const [u, v, lift] of outline) {
          const p = start
            .clone()
            .addScaledVector(axis, u)
            .addScaledVector(side, width * v);
          p.y += lift * length;
          vertex(p, color);
        }
        for (let edge = 0; edge < outline.length; edge++)
          indices.push(base, base + 1 + edge, base + 1 + ((edge + 1) % outline.length));
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
