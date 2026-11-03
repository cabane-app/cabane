import { ToonMaterial } from "@cabane/engine";
import { Quaternion, Shape, Vector3 } from "three";

type Point = [number, number, number];

export function StrollerTube({
  start,
  end,
  radius = 0.014,
  color = "#727c7e",
}: {
  start: Point;
  end: Point;
  radius?: number;
  color?: string;
}) {
  const a = new Vector3(...start);
  const b = new Vector3(...end);
  const direction = b.clone().sub(a);
  return (
    <mesh
      position={a.clone().add(b).multiplyScalar(0.5).toArray()}
      quaternion={new Quaternion()
        .setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
        .toArray()}
      userData={{ strollerTube: { start, end } }}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, direction.length(), 8]} />
      <ToonMaterial color={color} />
    </mesh>
  );
}

export function StrollerWheel({ x, z, radius }: { x: number; z: number; radius: number }) {
  return (
    <group position={[x, radius, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} userData={{ strollerWheel: true }} castShadow>
        <cylinderGeometry args={[radius, radius, 0.05, 20]} />
        <ToonMaterial color="#353b3d" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.57, radius * 0.57, 0.052, 12]} />
        <ToonMaterial color="#8c9798" />
      </mesh>
    </group>
  );
}

const canopy = new Shape();
canopy.absarc(0.05, 0.75, 0.25, 0, Math.PI * 0.7, false);
canopy.absarc(0.05, 0.75, 0.238, Math.PI * 0.7, 0, true);
canopy.closePath();

export function StrollerCanopy({ color }: { color: string }) {
  return (
    <mesh position={[-0.225, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      <extrudeGeometry
        args={[canopy, { depth: 0.45, bevelEnabled: false, curveSegments: 10, steps: 1 }]}
      />
      <ToonMaterial color={color} />
    </mesh>
  );
}
