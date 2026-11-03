import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Shape } from "three";

export const US_MAILBOX_SIZE = [0.28, 1.3, 0.5] as const;

function tunnelProfile(radius: number, bottom: number) {
  const profile = new Shape();
  profile.moveTo(-radius, bottom);
  profile.lineTo(radius, bottom);
  profile.lineTo(radius, 1.18);
  profile.absarc(0, 1.18, radius, 0, Math.PI, false);
  profile.lineTo(-radius, bottom);
  profile.closePath();
  return profile;
}

const bodyProfile = tunnelProfile(0.12, 1.02);
const doorProfile = tunnelProfile(0.112, 1.028);
const flagProfile = new Shape();
flagProfile.moveTo(-0.106, 1.125);
flagProfile.lineTo(-0.094, 1.125);
flagProfile.lineTo(-0.094, 1.25);
flagProfile.lineTo(-0.038, 1.25);
flagProfile.lineTo(-0.038, 1.29);
flagProfile.lineTo(-0.106, 1.29);
flagProfile.closePath();

/** Generic rural mailbox, including its timber post and raised red flag. */
export function UsMailbox({ size = US_MAILBOX_SIZE }: { size?: SceneItemSize } = {}) {
  return (
    <group
      name="us-mailbox"
      scale={[size[0] / 0.28, size[1] / 1.3, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      <mesh name="timber-post" position={[-0.02, 0.5125, -0.055]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 1.025, 0.09]} />
        <ToonMaterial color="#ad8960" />
      </mesh>
      <mesh name="mailbox-support" position={[-0.02, 1.01, -0.025]} castShadow receiveShadow>
        <boxGeometry args={[0.23, 0.04, 0.42]} />
        <ToonMaterial color="#ad8960" />
      </mesh>
      <mesh name="rounded-mailbox-body" position={[-0.02, 0, -0.25]} castShadow receiveShadow>
        <extrudeGeometry
          args={[bodyProfile, { depth: 0.465, bevelEnabled: false, curveSegments: 12 }]}
        />
        <ToonMaterial color="#d7d9d5" />
        <Outlines color="#777e79" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="front-door" position={[-0.02, 0, 0.213]} castShadow receiveShadow>
        <extrudeGeometry
          args={[doorProfile, { depth: 0.017, bevelEnabled: false, curveSegments: 12 }]}
        />
        <ToonMaterial color="#bec4bf" />
        <Outlines color="#777e79" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="door-pull" position={[-0.02, 1.236, 0.239]} castShadow>
        <boxGeometry args={[0.055, 0.018, 0.022]} />
        <ToonMaterial color="#646e68" />
      </mesh>
      <mesh
        name="door-hinge"
        position={[-0.02, 1.038, 0.232]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.008, 0.008, 0.17, 10]} />
        <ToonMaterial color="#7c847e" />
      </mesh>
      <mesh
        name="flag-pivot"
        position={[0.115, 1.13, 0.1]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.016, 0.016, 0.034, 12]} />
        <ToonMaterial color="#8f9991" />
      </mesh>
      <mesh name="tiny-red-flag" position={[0.124, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <extrudeGeometry args={[flagProfile, { depth: 0.016, bevelEnabled: false }]} />
        <ToonMaterial color="#c73b31" />
      </mesh>
    </group>
  );
}
