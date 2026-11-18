import { Outlines, ToonMaterial } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";

export const SHOWER_TRAY_WIDTH = 2;

// All contours run clockwise as seen from above. The floor pitches gently into
// the drain; the rounded perimeter and inner return belong to the same casting.
const rings = [
  [0.98, 0.425, 0, 0, 0],
  [0.999, 0.444, 0.005, 0, 0],
  [SHOWER_TRAY_WIDTH / 2, 0.445, 0.039, 0, 0],
  [0.996, 0.441, 0.045, 0, 0],
  [0.967, 0.412, 0.045, 0, 0],
  [0.956, 0.401, 0.036, 0, 0],
  [0.936, 0.381, 0.031, 0, 0],
  [0.071, 0.071, 0.015, -0.72, 0.24],
  [0.064, 0.064, 0.011, -0.72, 0.24],
];
const points: number[] = [],
  indices: number[] = [];
for (const [w, d, y, x, z] of rings) {
  const r = Math.min(0.04, w * 0.19);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    for (let j = 0; j <= 4; j++) {
      const turn = a + (j * Math.PI) / 8;
      points.push(
        x + Math.sign(Math.cos(a + 0.5)) * (w - r) + r * Math.cos(turn),
        y,
        z + Math.sign(Math.sin(a + 0.5)) * (d - r) + r * Math.sin(turn),
      );
    }
  }
}
for (let level = 0; level < rings.length - 1; level++)
  for (let i = 0; i < 20; i++) {
    const a = level * 20 + i,
      b = level * 20 + ((i + 1) % 20);
    indices.push(a, a + 20, b, b, a + 20, b + 20);
  }
for (let i = 1; i < 19; i++) indices.push(0, i, i + 1);
const tray = new BufferGeometry();
tray.setAttribute("position", new Float32BufferAttribute(points, 3));
tray.setIndex(indices);
tray.computeVertexNormals();
export function WideShowerTray() {
  return (
    <group name="receveur-douche-suite-parentale-custom" userData={{ walkCollider: true }}>
      <mesh name="sloping-shower-tray" geometry={tray} dispose={null} castShadow receiveShadow>
        <ToonMaterial color="#f1f2ef" />
        <Outlines color="#aeb5b2" thickness={0.0013} screenspace={false} />
      </mesh>
      <mesh name="drain-well" position={[-0.72, 0.01, 0.24]}>
        <boxGeometry args={[0.134, 0.006, 0.134]} />
        <ToonMaterial color="#626d69" />
      </mesh>
      <mesh name="lift-out-drain-cover" position={[-0.72, 0.014, 0.24]}>
        <boxGeometry args={[0.115, 0.007, 0.115]} />
        <ToonMaterial color="#a2aaa5" />
      </mesh>
    </group>
  );
}
