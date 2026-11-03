import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const SAGE_ROUNDED_FOOTSTOOL_SIZE = [0.48, 0.45, 0.46] as const;
/** Generic proportions inferred from reference appearance, not manufacturer measurements. */
export function SageRoundedFootstool({
  size = SAGE_ROUNDED_FOOTSTOOL_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="sage-rounded-footstool"
      scale={[size[0] / 0.48, size[1] / 0.45, size[2] / 0.46]}
      userData={{ walkCollider: true }}
    >
      {[-0.17, 0.17].flatMap((x) =>
        [-0.16, 0.16].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.06, z]}>
            <boxGeometry args={[0.04, 0.12, 0.04]} />
            <ToonMaterial color="#bb976d" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.48, 0.34, 0.46]}
        position={[0, 0.28, 0]}
        color={color ?? "#819b8d"}
        radius={0.085}
        outlineColor="#617d6e"
      />
    </group>
  );
}
