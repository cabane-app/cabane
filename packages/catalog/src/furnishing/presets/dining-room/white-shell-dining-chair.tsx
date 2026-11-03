import { ToonMaterial, Outlines, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { whiteChairShell } from "./white-chair-shell";
import { whiteChairOakLegs } from "./white-chair-oak-base";
export const WHITE_SHELL_DINING_CHAIR_SIZE = [0.46, 0.84, 0.54] as const;
export function WhiteShellDiningChair({
  size = WHITE_SHELL_DINING_CHAIR_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="white-shell-dining-chair"
      scale={[size[0] / 0.46, size[1] / 0.84, size[2] / 0.54]}
      userData={{ walkCollider: true }}
    >
      <mesh
        name="continuous-white-seat-and-back"
        geometry={whiteChairShell}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#eeede7" />
        <Outlines color="#bbb8ad" thickness={0.0015} screenspace={false} />
      </mesh>
      <RoundedFurniturePanel
        name="oak-chair-seat-mount"
        size={[0.34, 0.02, 0.28]}
        position={[0, 0.42, 0]}
        color="#c7a67b"
        radius={0.002}
        outline={false}
      />
      <mesh
        name="four-splayed-oak-chair-legs"
        geometry={whiteChairOakLegs}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#c7a67b" />
      </mesh>
    </group>
  );
}
