import { Quaternion, Vector3 } from "three";
import { ToonMaterial } from "@cabane/engine";

/** A straight guard wire, including sloping connections to the mounting frame. */
export function PlatformFanGuardWire({
  name,
  from,
  to,
}: {
  name: string;
  from: [number, number, number];
  to: [number, number, number];
}) {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return (
    <mesh
      name={name}
      position={start.clone().add(end).multiplyScalar(0.5).toArray()}
      quaternion={rotation.toArray()}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[0.001, 0.001, direction.length(), 8]} />
      <ToonMaterial color="#afb2aa" />
    </mesh>
  );
}
