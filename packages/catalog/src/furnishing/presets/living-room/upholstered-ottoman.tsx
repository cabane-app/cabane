import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const UPHOLSTERED_OTTOMAN_SIZE = [0.7, 0.42, 0.55] as const;

/** Compact upholstered footstool and occasional seat. */
export function UpholsteredOttoman({
  size = UPHOLSTERED_OTTOMAN_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="upholstered-ottoman"
      scale={[size[0] / 0.7, size[1] / 0.42, size[2] / 0.55]}
      userData={{ walkCollider: true }}
    >
      {[-0.27, 0.27].flatMap((x) =>
        [-0.195, 0.195].map((z) => (
          <mesh key={`${x}-${z}`} name="ottoman-foot" position={[x, 0.045, z]} castShadow>
            <boxGeometry args={[0.055, 0.09, 0.055]} />
            <ToonMaterial color="#a67d51" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.64, 0.23, 0.49]}
        position={[0, 0.205, 0]}
        color={color ?? "#c9b9a1"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="ottoman-cushion"
        size={[0.7, 0.17, 0.55]}
        position={[0, 0.335, 0]}
        color={color ?? "#ded1ba"}
        radius={0.065}
      />
      <mesh name="ottoman-seam" position={[0, 0.405, 0.273]}>
        <boxGeometry args={[0.58, 0.008, 0.004]} />
        <ToonMaterial color={color ?? "#aa9c85"} />
      </mesh>
    </group>
  );
}
