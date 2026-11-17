import { ToonMaterial } from "@cabane/engine";
import { Quaternion, Vector3 } from "three";
type Point = readonly [number, number, number];
/** Flat metal strip whose local Y endpoints meet the specified joints. */
export function FoldingFrameStrip({
  name,
  from,
  to,
  color = "#343936",
}: {
  name: string;
  from: Point;
  to: Point;
  color?: string;
}) {
  const start = new Vector3(...from),
    end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const middle = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return (
    <mesh
      name={name}
      position={[middle.x, middle.y, middle.z]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
      userData={{ frameEndpoints: [from, to] }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.018, direction.length(), 0.012]} />
      <ToonMaterial color={color} />
    </mesh>
  );
}
