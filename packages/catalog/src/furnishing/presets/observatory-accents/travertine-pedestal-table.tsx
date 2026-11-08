import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";

export const TRAVERTINE_PEDESTAL_TABLE_SIZE = [0.5, 0.52, 0.5] as const;
const profile = [
  [0, 0],
  [0.17, 0],
  [0.18, 0.015],
  [0.18, 0.04],
  [0.155, 0.06],
  [0.105, 0.4],
  [0.12, 0.45],
  [0.23, 0.45],
  [0.25, 0.47],
  [0.25, 0.5],
  [0.23, 0.52],
  [0, 0.52],
].map(([x, y]) => new Vector2(x, y));

export function TravertinePedestalTable({
  size = TRAVERTINE_PEDESTAL_TABLE_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="travertine-pedestal-table"
      scale={[size[0] / 0.5, size[1] / 0.52, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      <mesh name="turned-stone-table" castShadow receiveShadow>
        <latheGeometry args={[profile, 32]} />
        <ToonMaterial color="#cbbda5" />
      </mesh>
    </group>
  );
}
