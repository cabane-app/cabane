import { useEffect, useMemo } from "react";
import { BoxGeometry, Float32BufferAttribute, Vector3 } from "three";
import { ArchitecturalMaterial } from "../architecture-scene/ArchitecturalMaterial";
import { useScannedFinish } from "../scanned-finishes";

function clippedCanopy(length: number, height: number, width: number) {
  const half = new Vector3(length / 2, height / 2, width / 2);
  const radius = Math.min(0.16, width * 0.31, height * 0.24, length * 0.24);
  const core = half.clone().addScalar(-radius);
  const low = core.clone().negate();
  const step = Math.min(0.94, 0.3 + length * 0.025);
  const columns = 2 * Math.min(45, Math.max(3, Math.ceil(length / step)));
  const shell = new BoxGeometry(length, height, width, columns, 4, 4);
  // Concentrate the rails at the shoulders and foot of the clipped profile.
  const rails = (halfSize: number) => [
    -halfSize,
    -halfSize + radius * 0.85,
    0,
    halfSize - radius * 0.85,
    halfSize,
  ];
  const ys = rails(half.y),
    zs = rails(half.z);
  const xs = Array.from({ length: columns + 1 }, (_, i) =>
    i === 0 ? -half.x : i === columns ? half.x : core.x * ((2 * (i - 1)) / (columns - 2) - 1),
  );
  const crown: Vector3[][] = zs.map(() => []);
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    colors: number[] = [];
  const indices = Array.from(shell.index!.array);

  function shape(x: number, y: number, z: number) {
    const point = new Vector3(x, y, z);
    const inner = point.clone().clamp(low, core);
    const normal = point.clone().sub(inner).normalize();
    point.copy(inner).addScaledVector(normal, radius);
    const level = 0.5 + point.y / height;
    const wave = 0.52 + 0.29 * Math.sin(5.6 * x + z * 4.8) + 0.18 * Math.sin(x * 12.5 - y * 3.1);
    // The clipped profile has a full belly, an uneven crown and a narrower foot.
    const edge = Math.min(1, Math.abs(x) * 3 + Math.abs(z) / half.z);
    point.y += half.y - level ** 4 * radius * (0.16 + wave * 0.38) * edge;
    const room = Math.min(1, Math.abs(x) * 4 + Math.abs(level - 0.5) * 4);
    point.z *= 1 - (0.1 * (1 - level) ** 4 + 0.052 * wave) * room;
    return { point, normal, level, wave };
  }

  for (let i = 0; i < shell.attributes.position.count; i++) {
    const p = new Vector3().fromBufferAttribute(shell.attributes.position, i);
    const ix = Math.round((p.x / length + 0.5) * columns);
    const iz = Math.round((p.z / width + 0.5) * 4);
    p.set(xs[ix]!, ys[Math.round((p.y / height + 0.5) * 4)]!, zs[iz]!);
    const { point, normal, level, wave } = shape(p.x, p.y, p.z);
    positions.push(...point.toArray());
    normals.push(...normal.toArray());
    const face = shell.attributes.normal;
    if (face.getY(i) > 0.5) crown[iz]![ix] = point;
    uvs.push(
      Math.abs(face.getX(i)) > 0.5 ? p.z : p.x,
      Math.abs(face.getY(i)) > 0.5 ? p.z : p.y + half.y,
    );
    const pigment = 0.68 + 0.26 * level + 0.11 * wave;
    colors.push(pigment, pigment, pigment);
  }

  function crownPoint(x: number, z: number) {
    const ix = Math.max(0, xs.findIndex((next) => next >= x) - 1);
    const iz = Math.max(0, zs.findIndex((next) => next >= z) - 1);
    const u = (x - xs[ix]!) / (xs[ix + 1]! - xs[ix]!);
    const v = (z - zs[iz]!) / (zs[iz + 1]! - zs[iz]!);
    // Interpolate the same diagonal as the shell so each shoot stays rooted
    // when a long run has fewer samples than the small undulations in shape().
    const near = u + v <= 1;
    return (near ? crown[iz]![ix]! : crown[iz + 1]![ix + 1]!)
      .clone()
      .multiplyScalar(Math.abs(1 - u - v))
      .addScaledVector(crown[iz]![ix + 1]!, near ? u : 1 - v)
      .addScaledVector(crown[iz + 1]![ix]!, near ? v : 1 - u);
  }

  // Pairs of small oval tips along the two shoulders interrupt the printed
  // silhouette without adding transparent layers or another material.
  const shoots = Math.min(420, Math.max(2, Math.ceil(length * 24)));
  const size = Math.min(0.055, width * 0.12, height * 0.09, length * 0.12);
  const fract = (n: number) => n - Math.floor(n);
  for (let i = 0; i < shoots; i++) {
    const side = i % 2 ? 1 : -1;
    const x = ((i + 0.5 + 0.35 * Math.sin(i * 3.7)) / shoots - 0.5) * (length - 2 * size);
    const z = side * half.z * (0.66 + 0.34 * fract(i * 0.618));
    const point = crownPoint(x, z);
    const normal = shape(x, half.y, z).normal;
    const origin = point.clone().addScaledVector(normal, -0.004);
    for (const hand of [-1, 1]) {
      const width = size * (0.15 + 0.07 * fract(i * 0.272));
      const along = new Vector3(
        hand * (0.5 + 0.44 * fract(i * 0.417)),
        0.52,
        side * Math.sin(i * 1.8) * 0.42,
      ).multiplyScalar(size);
      const cross = new Vector3().crossVectors(normal, along).normalize().multiplyScalar(width);
      const first = positions.length / 3;
      const shade = 1.15 + 0.35 * fract(i * 0.33);
      for (const [t, w] of [
        [0, 0],
        [0.52, -1],
        [1, 0],
        [0.55, 1],
      ]) {
        const vertex =
          t === 0 ? origin : origin.clone().addScaledVector(along, t).addScaledVector(cross, w);
        vertex.y = Math.min(height, vertex.y);
        vertex.z = Math.max(-half.z, Math.min(half.z, vertex.z));
        positions.push(...vertex.toArray());
        normals.push(...normal.toArray());
        // Sample the local scanned pigment so new growth belongs to its branch.
        uvs.push(x + 0.04 * t, point.z + 0.014 * w);
        colors.push(shade, shade, shade * 0.94);
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  shell.setAttribute("position", new Float32BufferAttribute(positions, 3));
  shell.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  shell.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  shell.setAttribute("color", new Float32BufferAttribute(colors, 3));
  shell.setIndex(indices);
  shell.clearGroups();
  return shell;
}

/** One opaque leafy surface replaces the regular raised dots of the stylized hedge. */
export function BoxwoodCanopy({
  length,
  height,
  width,
}: {
  length: number;
  height: number;
  width: number;
}) {
  const geometry = useMemo(() => clippedCanopy(length, height, width), [length, height, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const leaves = useScannedFinish("boxwood", "grounds");
  return (
    <mesh
      name="boxwood-canopy"
      geometry={geometry}
      userData={{ thumbnailPending: leaves === null }}
      castShadow
      receiveShadow
    >
      <ArchitecturalMaterial
        key={leaves ? "leaves" : "solid"}
        feature="grounds"
        color={leaves ? "#ffffff" : "#536343"}
        map={leaves ?? null}
        vertexColors
        roughness={0.94}
      />
    </mesh>
  );
}
