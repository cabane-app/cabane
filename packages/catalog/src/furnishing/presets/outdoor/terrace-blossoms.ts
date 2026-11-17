import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";

// Each trumpet is a continuous corolla. Its five lobes flare out from a warm throat.
export function terraceBlossoms(petal: string) {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const green = new Color("#78895a"),
    sage = new Color("#91a275");
  const flower = new Color(petal),
    throat = new Color("#e2c582");
  const vertex = (p: Vector3, color: Color, shade = 1) => {
    positions.push(...p.toArray());
    colors.push(color.r * shade, color.g * shade, color.b * shade);
    return positions.length / 3 - 1;
  };
  function bridge(a: number, b: number, n: number) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      indices.push(a + j, b + j, a + k, a + k, b + j, b + k);
    }
  }
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.4,
      reach = i === 0 ? 0 : 0.074 + (0.095 * (i % 4)) / 3;
    const height = i === 0 ? 0.75 : 0.562 + (1 - reach / 0.17) * 0.17 + 0.025 * Math.cos(i);
    const radial = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new Vector3(-radial.z, 0, radial.x);
    const stalk = (t: number) =>
      radial
        .clone()
        .multiplyScalar(reach * (0.22 + 0.78 * t * t))
        .addScaledVector(across, 0.011 * Math.sin(Math.PI * t))
        .setY(0.31 + t * (height - 0.31));
    let ring = positions.length / 3;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5,
        center = stalk(t),
        start = positions.length / 3,
        r = 0.0055 - 0.0025 * t;
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        vertex(
          center
            .clone()
            .addScaledVector(radial, r * Math.cos(a))
            .addScaledVector(across, r * Math.sin(a)),
          green,
        );
      }
      if (k) bridge(ring, start, 6);
      ring = start;
    }
    for (let k = 0; k < 5; k++) {
      const t = 0.11 + k * 0.15,
        origin = stalk(t),
        bearing = angle + k * 2.52;
      const d = new Vector3(Math.cos(bearing), 0, Math.sin(bearing)),
        side = new Vector3(-d.z, 0, d.x);
      const start = positions.length / 3;
      for (let j = 0; j <= 5; j++) {
        const u = j / 5,
          wave = Math.sin(Math.PI * u),
          center = origin.clone().addScaledVector(d, u * (0.09 - 0.007 * k));
        center.y += 0.055 * u + 0.021 * wave;
        for (const s of [-1, 0, 1]) {
          const p = center.clone().addScaledVector(side, s * (wave * 0.023 + 0.0003));
          if (!s) p.y += 0.008 * wave;
          vertex(p, sage, s < 0 ? 0.8 : 1);
        }
        if (j) {
          const b = start + 3 * j;
          indices.push(b - 3, b, b - 2, b - 2, b, b + 1, b - 2, b + 1, b - 1, b - 1, b + 1, b + 2);
        }
      }
    }
    const origin = stalk(1),
      tilt = i === 0 ? 0 : 0.69 + 0.13 * (i % 3);
    const axis = radial.clone().multiplyScalar(Math.sin(tilt)).setY(Math.cos(tilt));
    const span = axis.clone().cross(across);
    const size = i === 0 ? 1 : 0.8 + (i % 4) * 0.08;
    const rings = [
      [0.003, 0, 0],
      [0.007, 0.014, 0],
      [0.015, 0.029, 0.05],
      [0.033, 0.042, 0.13],
      [0.048, 0.047, 0.19],
    ];
    for (const [k, [radius, y, wave]] of rings.entries()) {
      const start = positions.length / 3;
      for (let j = 0; j < 25; j++) {
        const a = (j * Math.PI * 2) / 25,
          lobe = Math.cos(a * 5),
          r = radius * size * (1 + wave * lobe);
        const p = origin
          .clone()
          .addScaledVector(axis, size * (y + (k === 4 ? 0.003 * lobe : 0)))
          .addScaledVector(across, r * Math.cos(a))
          .addScaledVector(span, r * Math.sin(a));
        const color = k === 0 ? green : k === 1 ? throat : flower;
        vertex(p, color, k < 2 ? 1 : 0.77 + 0.095 * (k - 2) + 0.045 * lobe);
      }
      if (k) bridge(ring, start, 25);
      ring = start;
    }
  }
  const mesh = new BufferGeometry();
  mesh.setAttribute("position", new Float32BufferAttribute(positions, 3));
  mesh.setAttribute("color", new Float32BufferAttribute(colors, 3));
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  return mesh;
}
