import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";

type Ring = readonly [height: number, width: number, depth: number];
const ink = "#182637";
const graphite = "#384659";
const shell = "#eda83e";
const ivory = "#e8e3cd";
const signal = "#81ffed";

// Eight clipped corners give the housing broad faces for the switch and armor plates.
const perimeter = [
  [-0.68, -1],
  [0.68, -1],
  [1, -0.62],
  [1, 0.62],
  [0.68, 1],
  [-0.68, 1],
  [-1, 0.62],
  [-1, -0.62],
] as const;

function flashlightGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const key = new Vector3(-0.5, -0.25, -0.83).normalize();
  function face(a: Vector3, b: Vector3, c: Vector3, paint: string) {
    const light = b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(key);
    const shade = paint === signal ? 1 : light > 0.55 ? 1.12 : light > 0 ? 0.87 : 0.62;
    const color = new Color(paint).multiplyScalar(shade);
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      colors.push(color.r, color.g, color.b);
    }
  }
  function housing(rings: Ring[], paints: string[], x = 0, z = 0) {
    const loops = rings.map(([y, w, d]) =>
      perimeter.map(([u, v]) => new Vector3(x + u * w, y, z + v * d)),
    );
    for (let i = 0; i < loops.length; i++) {
      const ring = loops[i];
      for (let j = 0; j < ring.length; j++) {
        const k = (j + 1) % ring.length;
        if (i === 0) face(ring[j], ring[k], new Vector3(x, rings[i][0], z), paints[0]);
        if (i === loops.length - 1) {
          face(ring[k], ring[j], new Vector3(x, rings[i][0], z), paints[i - 1]);
        } else {
          const next = loops[i + 1];
          face(ring[j], next[j], next[k], paints[i]);
          face(ring[j], next[k], ring[k], paints[i]);
        }
      }
    }
  }

  // Armored heel, rubber grip and exposed graphite shoulder behind the lamp.
  housing(
    [
      [-0.154, 0.038, 0.035],
      [-0.143, 0.052, 0.047],
      [-0.128, 0.052, 0.047],
      [-0.122, 0.047, 0.043],
      [0.028, 0.044, 0.041],
      [0.064, 0.057, 0.05],
      [0.083, 0.057, 0.05],
    ],
    [graphite, shell, ink, graphite, ink, graphite],
  );
  for (const y of [-0.105, -0.079, -0.053]) {
    housing(
      [
        [y, 0.047, 0.043],
        [y + 0.006, 0.049, 0.046],
        [y + 0.014, 0.047, 0.043],
      ],
      [ink, "#536072"],
    );
  }

  // Ceramic rear collar and stepped amber bezel sandwich a dark recessed seam.
  housing(
    [
      [0.057, 0.053, 0.047],
      [0.075, 0.065, 0.055],
      [0.095, 0.068, 0.058],
      [0.1, 0.065, 0.055],
      [0.106, 0.065, 0.055],
      [0.125, 0.08, 0.069],
      [0.164, 0.082, 0.07],
      [0.172, 0.076, 0.065],
    ],
    [ivory, ivory, ink, graphite, shell, shell, "#ffcc68"],
  );
  housing(
    [
      [0.17, 0.076, 0.065],
      [0.182, 0.08, 0.069],
      [0.19, 0.074, 0.063],
    ],
    [ink, graphite],
  );
  housing(
    [
      [0.19, 0.064, 0.054],
      [0.192, 0.062, 0.052],
    ],
    [signal],
  );

  // Raised dorsal switch and two illuminated charge marks face the player.
  housing(
    [
      [-0.037, 0.018, 0.008],
      [-0.026, 0.024, 0.014],
      [0.038, 0.023, 0.014],
      [0.051, 0.016, 0.008],
    ],
    [ink, ink, graphite],
    0,
    -0.041,
  );
  housing(
    [
      [-0.018, 0.013, 0.005],
      [-0.01, 0.016, 0.009],
      [0.015, 0.016, 0.009],
      [0.021, 0.013, 0.005],
    ],
    ["#bd7130", shell, "#ffce75"],
    0,
    -0.054,
  );
  for (const y of [0.028, 0.036]) {
    housing(
      [
        [y, 0.009, 0.002],
        [y + 0.003, 0.009, 0.002],
      ],
      [signal],
      0,
      -0.056,
    );
  }
  for (const x of [-0.047, 0.047]) {
    housing(
      [
        [0.114, 0.006, 0.004],
        [0.126, 0.009, 0.008],
        [0.158, 0.009, 0.008],
      ],
      [ink, ivory],
      x,
      -0.065,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

export default function FlashlightModel() {
  const geometry = useMemo(flashlightGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh rotation={[-Math.PI / 2 + 0.17, 0, -0.28]} geometry={geometry}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
}
