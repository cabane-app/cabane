import { ToonMaterial } from "@cabane/engine";
import { CubicBezierCurve3, Vector2, Vector3 } from "three";
import { FamilyBathShell } from "./family-bath-shell";

const tapBody = [
  [0, 0],
  [0.036, 0],
  [0.036, 0.006],
  [0.03, 0.012],
  [0.021, 0.017],
  [0.018, 0.028],
  [0.017, 0.106],
  [0.023, 0.112],
  [0.023, 0.125],
  [0, 0.125],
].map(([r, y]) => new Vector2(r, y));
const spout = new CubicBezierCurve3(
  new Vector3(0, 0.1, 0),
  new Vector3(0, 0.2403, 0.008),
  new Vector3(0, 0.208, 0.176),
  new Vector3(0, 0.154, 0.179),
);

export function FamilyBathroomBathtub() {
  return (
    <group name="family-bathroom-bathtub" userData={{ walkCollider: true }}>
      <FamilyBathShell />
      <group position={[0.46, 0.565, -0.344]}>
        {[-0.133, 0.133].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow>
              <latheGeometry args={[tapBody, 16]} />
              <ToonMaterial color="#858d8b" />
            </mesh>
            <mesh position={[0, 0.134, 0]} castShadow>
              <cylinderGeometry args={[0.027, 0.023, 0.025, 12]} />
              <ToonMaterial color="#a8afac" />
            </mesh>
            <mesh
              position={[x < 0 ? -0.028 : 0.028, 0.147, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.009, 0.012, 0.075, 12]} />
              <ToonMaterial color="#eeeae3" />
            </mesh>
          </group>
        ))}
        <mesh castShadow>
          <latheGeometry args={[tapBody, 16]} />
          <ToonMaterial color="#858d8b" />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[spout, 24, 0.017, 12, false]} />
          <ToonMaterial color="#939d99" />
        </mesh>
        <mesh position={[0, 0.151, 0.179]}>
          <cylinderGeometry args={[0.018, 0.016, 0.013, 14]} />
          <ToonMaterial color="#727d79" />
        </mesh>
      </group>
    </group>
  );
}
