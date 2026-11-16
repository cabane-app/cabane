import { ToonMaterial } from "@cabane/engine";
import { CubicBezierCurve3, Vector2, Vector3 } from "three";
const body = [
  [0, 0],
  [0.03, 0],
  [0.03, 0.006],
  [0.026, 0.009],
  [0.021, 0.01],
  [0.021, 0.26],
  [0.023, 0.269],
  [0.023, 0.287],
  [0.02, 0.292],
  [0, 0.292],
].map(([r, y]) => new Vector2(r, y));
const spout = new CubicBezierCurve3(
  new Vector3(-0.012, 0.264, 0),
  new Vector3(-0.08, 0.28, 0),
  new Vector3(-0.167, 0.3, 0),
  new Vector3(-0.167, 0.236, 0),
);

/** Deck-mounted monobloc with a swan-neck outlet and a raised pin lever. */
export function VesselMixer({ color, trim }: { color: string; trim: string }) {
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[body, 16]} />
        <ToonMaterial color={color} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[spout, 14, 0.013, 10, false]} />
        <ToonMaterial color={color} />
      </mesh>
      <mesh position={[-0.167, 0.234, 0]}>
        <cylinderGeometry args={[0.014, 0.012, 0.01, 14]} />
        <ToonMaterial color={trim} />
      </mesh>
      <mesh position={[0, 0.296, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.021, 0.015, 16]} />
        <ToonMaterial color={trim} />
      </mesh>
      <mesh position={[0, 0.328, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.011, 0.064, 12]} />
        <ToonMaterial color={color} />
      </mesh>
    </group>
  );
}
