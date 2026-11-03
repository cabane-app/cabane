import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const FRENCH_WALL_MAILBOX_SIZE = [0.3, 0.4, 0.16] as const;

/** Generic painted-metal French wall mailbox; back Z=0, bottom Y=0. */
export function FrenchWallMailbox({
  size = FRENCH_WALL_MAILBOX_SIZE,
}: { size?: SceneItemSize } = {}) {
  return (
    <group name="french-wall-mailbox" scale={[size[0] / 0.3, size[1] / 0.4, size[2] / 0.16]}>
      <RoundedFurniturePanel
        name="metal-case"
        size={[0.3, 0.4, 0.142]}
        position={[0, 0.2, 0.071]}
        color="#566957"
        outlineColor="#354637"
        radius={0.009}
      />
      <RoundedFurniturePanel
        name="retrieval-door"
        size={[0.276, 0.298, 0.012]}
        position={[0, 0.161, 0.146]}
        color="#647763"
        outlineColor="#435543"
        radius={0.004}
      />
      <RoundedFurniturePanel
        name="posting-slot-shadow"
        size={[0.254, 0.036, 0.004]}
        position={[0, 0.35, 0.143]}
        color="#303d32"
        radius={0.002}
        outline={false}
      />
      <RoundedFurniturePanel
        name="posting-flap"
        size={[0.262, 0.034, 0.018]}
        position={[0, 0.359, 0.151]}
        color="#71836c"
        outlineColor="#435543"
        radius={0.004}
      />
      <RoundedFurniturePanel
        name="nameplate-frame"
        size={[0.096, 0.033, 0.005]}
        position={[0, 0.254, 0.1535]}
        color="#b6b8aa"
        radius={0.002}
        outline={false}
      />
      <mesh name="blank-nameplate" position={[0, 0.254, 0.1565]}>
        <boxGeometry args={[0.084, 0.023, 0.003]} />
        <ToonMaterial color="#e4e1d3" />
      </mesh>
      <mesh name="door-lock" position={[0.103, 0.16, 0.154]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.01, 12]} />
        <ToonMaterial color="#b8bbb2" />
      </mesh>
      <mesh name="key-slot" position={[0.103, 0.16, 0.159]}>
        <boxGeometry args={[0.002, 0.008, 0.002]} />
        <ToonMaterial color="#3c443d" />
      </mesh>
    </group>
  );
}
