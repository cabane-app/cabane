import { Outlines, ToonMaterial } from "@cabane/engine";
import { Quaternion, Vector3 } from "three";

const HUB = new Vector3(0, 0.12, -0.055);
const FEET = [
  [-0.37, 0.025, 0.17],
  [0.37, 0.025, 0.17],
  [0, 0.025, -0.17],
] as const;

/** Each local-Y leg runs directly from its surface pad to the common hub. */
export function TripodStand() {
  return (
    <group name="tripod-stand">
      {FEET.map((point, index) => {
        const foot = new Vector3(...point);
        const direction = HUB.clone().sub(foot);
        const rotation = new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          direction.clone().normalize(),
        );
        return (
          <group key={index}>
            <mesh
              name={`tripod-leg-${index}`}
              position={foot.clone().add(HUB).multiplyScalar(0.5).toArray()}
              quaternion={rotation.toArray()}
              castShadow
            >
              <cylinderGeometry args={[0.016, 0.014, direction.length(), 8]} />
              <ToonMaterial color="#b78b59" />
              <Outlines color="#785f44" thickness={0.0015} screenspace={false} />
            </mesh>
            <mesh name={`tripod-foot-${index}`} position={point} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.05, 12]} />
              <ToonMaterial color="#383d39" />
            </mesh>
          </group>
        );
      })}
      <mesh position={HUB.toArray()} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
        <ToonMaterial color="#424a45" />
      </mesh>
      <mesh position={[0, 0.17, -0.055]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 12]} />
        <ToonMaterial color="#424a45" />
      </mesh>
      <mesh position={[0, 0.22, -0.021]} castShadow>
        <boxGeometry args={[0.18, 0.12, 0.082]} />
        <ToonMaterial color="#424a45" />
      </mesh>
    </group>
  );
}
