import { Quaternion, Vector3 } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction";
import { CHAISE_BACK_ANGLE_RADIANS, CHAISE_BACK_CENTER } from "./chaise-upholstery";

const teak = "#a87745";
const teakDark = "#6d4a2c";

const roundedTeak = (
  key: string,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) => (
  <RoundedFurniturePanel
    key={key}
    name={key}
    size={size}
    position={position}
    rotation={rotation}
    color={teak}
    outline={false}
    radius={0.015}
  />
);

export function PoolChaiseFrame() {
  return (
    <group name="pool-chaise-teak-frame">
      {[-0.36, 0.36].map((x) =>
        roundedTeak(`pool-chaise-side-rail-${x}`, [0.08, 0.085, 1.97], [x, 0.165, 0.065]),
      )}
      {[-0.87, -0.39, 0.98].map((z) =>
        roundedTeak(`pool-chaise-cross-rail-${z}`, [0.64, 0.08, 0.08], [0, 0.17, z]),
      )}
      {[-0.36, 0.36].flatMap((x) =>
        [-0.8, 0.82].map((z) =>
          roundedTeak(`pool-chaise-leg-${x}-${z}`, [0.08, 0.17, 0.08], [x, 0.085, z]),
        ),
      )}
      {[-0.285, 0.285].map((x) =>
        roundedTeak(
          `pool-chaise-back-support-${x}`,
          [0.05, 0.05, 0.64],
          [x, CHAISE_BACK_CENTER[1] - 0.045, CHAISE_BACK_CENTER[2] - 0.04],
          [CHAISE_BACK_ANGLE_RADIANS, 0, 0],
        ),
      )}
      {[-0.285, 0.285].map((x) => {
        const bottom = new Vector3(x, 0.174, -0.868);
        const top = new Vector3(x, 0.51, -0.766);
        const direction = top.clone().sub(bottom);
        const midpoint = bottom.clone().lerp(top, 0.5);
        return (
          <group key={x}>
            <mesh
              name="adjustable-recline-stay"
              position={midpoint.toArray()}
              quaternion={new Quaternion()
                .setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
                .toArray()}
              castShadow
            >
              <cylinderGeometry args={[0.014, 0.018, direction.length(), 12]} />
              <ToonMaterial color="#836449" />
            </mesh>
            <RoundedFurniturePanel
              name="teak-hinge-cheek"
              position={[Math.sign(x) * 0.351, 0.234, -0.5]}
              size={[0.035, 0.124, 0.098]}
              radius={0.017}
              color={teak}
              outline={false}
            />
            <mesh
              name="backrest-pivot-cap"
              position={[Math.sign(x) * 0.373, 0.27, -0.5]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.04, 0.04, 0.027, 16]} />
              <ToonMaterial color="#9b7549" />
            </mesh>
          </group>
        );
      })}
      <mesh
        name="pool-chaise-back-hinge"
        position={[0, 0.27, -0.5]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.06, 0.06, 0.72, 16]} />
        <ToonMaterial color={teakDark} />
        <Outlines color="#55402d" thickness={0.0015} screenspace={false} />
      </mesh>
    </group>
  );
}
