import { Outlines, ToonMaterial } from "@cabane/engine";
import { Quaternion, Vector3 } from "three";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

type Point = [number, number, number];

/** Endpoint-driven supports keep all four splayed legs joined to the seat. */
export function ChairSupport({
  start,
  end,
  width,
  depth = width,
  color,
  round = false,
  name,
}: {
  start: Point;
  end: Point;
  width: number;
  depth?: number;
  color: string;
  round?: boolean;
  name: string;
}) {
  const a = new Vector3(...start);
  const b = new Vector3(...end);
  const direction = b.clone().sub(a);
  return (
    <group
      name={name}
      position={a.clone().add(b).multiplyScalar(0.5).toArray()}
      quaternion={new Quaternion()
        .setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
        .toArray()}
      userData={{ supportEndpoints: [start, end], supportLength: direction.length() }}
    >
      {round ? (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[width / 2, width / 2, direction.length(), 12]} />
          <ToonMaterial color={color} />
          <Outlines color="#97948c" thickness={0.0015} screenspace={false} />
        </mesh>
      ) : (
        <RoundedFurniturePanel
          size={[width, direction.length(), depth]}
          color={color}
          radius={0.003}
        />
      )}
    </group>
  );
}
