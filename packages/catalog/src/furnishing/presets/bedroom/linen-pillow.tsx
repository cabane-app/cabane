import { Outlines, ToonMaterial } from "@cabane/engine";
import { SphereGeometry } from "three";

// Sewn corners keep their breadth at the equator, with a pinched seam between
// the fuller faces. The slight twist breaks their symmetry when pillows overlap.
const ticking = new SphereGeometry(1, 24, 14);
const vertices = ticking.attributes.position;
const rounded = (v: number, power: number) => Math.sign(v) * Math.abs(v) ** power;
for (let i = 0; i < vertices.count; i++) {
  const x = rounded(vertices.getX(i), 0.54);
  const z = rounded(vertices.getZ(i), 0.56);
  const y = vertices.getY(i);
  const seam = 1 - 0.032 * Math.exp(-64 * y * y);
  vertices.setXYZ(i, 0.5 * seam * x, 0.49 * rounded(y, 0.75) + 0.028 * x * z, 0.5 * seam * z);
}
ticking.computeVertexNormals();

type Triple = [number, number, number];
export function LinenPillow({
  name,
  size,
  position,
  rotation,
  color,
  outlineColor,
}: {
  name: string;
  size: Triple;
  position: Triple;
  rotation?: Triple;
  color: string;
  outlineColor: string;
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <mesh name={name} geometry={ticking} dispose={null} scale={size} castShadow receiveShadow>
        <ToonMaterial color={color} />
        <Outlines color={outlineColor} thickness={0.0013} screenspace={false} />
      </mesh>
    </group>
  );
}
