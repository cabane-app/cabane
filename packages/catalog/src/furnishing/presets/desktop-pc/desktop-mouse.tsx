import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";

export const DESKTOP_MOUSE_SIZE = [0.065, 0.04, 0.115] as const;

export function DesktopMouse({ size = DESKTOP_MOUSE_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="desktop-mouse" scale={[size[0] / 0.065, size[1] / 0.04, size[2] / 0.115]}>
      <mesh position={[0, 0.019, 0]} scale={[0.0325, 0.019, 0.0575]} castShadow receiveShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <ToonMaterial color="#596368" />
        <Outlines color="#394349" thickness={0.001} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.036, -0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.014, 12]} />
        <ToonMaterial color="#283239" />
      </mesh>
    </group>
  );
}
