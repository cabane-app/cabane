import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { useEffect, useMemo } from "react";
export const ROUND_JUTE_RUG_SIZE = [2, 0.018, 2] as const;
/** A single broad three-ply braid, sewn from the center out. Diagonal ridges follow the spiral. */
function coil() {
  const pos: number[] = [],
    colors: number[] = [],
    idx: number[] = [];
  const turns = 25,
    steps = turns * 80,
    cross = 6;
  for (let n = 0; n <= steps; n++) {
    const theta = (n / 80) * Math.PI * 2,
      r = 0.019 + (0.96 * n) / steps;
    for (let j = 0; j <= cross; j++) {
      const t = j / cross,
        offset = (t - 0.5) * 0.0384;
      const phase = theta * (4 + 12 * r) + Math.abs(t - 0.5) * 4.6;
      const twist = (1 + Math.cos(phase)) / 2,
        crown = Math.sin(Math.PI * t);
      const radius = r + offset;
      pos.push(
        Math.sin(theta) * radius,
        0.008 + crown * (0.007 + 0.003 * twist),
        Math.cos(theta) * radius,
      );
      const fiber = 0.82 + 0.18 * twist * crown;
      colors.push(fiber, fiber, fiber);
      if (n < steps && j < cross) {
        const a = n * (cross + 1) + j,
          b = a + cross + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}
export function RoundJuteRug({
  size = ROUND_JUTE_RUG_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  const rope = useMemo(coil, []);
  useEffect(() => () => rope.dispose(), [rope]);
  return (
    <group scale={[size[0] / 2, size[1] / 0.018, size[2] / 2]}>
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[1, 0.997, 0.008, 96]} />
        <ToonMaterial color={color ?? "#bfa571"} />
      </mesh>
      <mesh geometry={rope} name="coiled-jute-braid" receiveShadow>
        <ToonMaterial color={color ?? "#cdb584"} vertexColors />
      </mesh>
    </group>
  );
}
