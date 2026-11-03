import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const SAGE_TUB_ARMCHAIR_SIZE = [0.78, 0.86, 0.8] as const;
/** Generic proportions inferred from reference appearance, not manufacturer measurements. */
export function SageTubArmchair({
  size = SAGE_TUB_ARMCHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="sage-tub-armchair"
      scale={[size[0] / 0.78, size[1] / 0.86, size[2] / 0.8]}
      userData={{ walkCollider: true }}
    >
      {[-0.27, 0.27].flatMap((x) =>
        [-0.28, 0.28].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.06, z]}>
            <boxGeometry args={[0.055, 0.12, 0.055]} />
            <ToonMaterial color="#bb976d" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.65, 0.24, 0.7]}
        position={[0, 0.24, 0.03]}
        color={color ?? "#748e81"}
        radius={0.065}
        outlineColor="#526e61"
      />
      <RoundedFurniturePanel
        size={[0.53, 0.15, 0.65]}
        position={[0, 0.435, 0.075]}
        color={color ?? "#819b8d"}
        radius={0.07}
        outlineColor="#617d6e"
      />
      {[-0.305, 0.305].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.17, 0.58, 0.7]}
          position={[x, 0.57, 0]}
          color={color ?? "#789486"}
          radius={0.08}
          outlineColor="#617d6e"
        />
      ))}
      <RoundedFurniturePanel
        size={[0.63, 0.64, 0.18]}
        position={[0, 0.54, -0.31]}
        color={color ?? "#789486"}
        radius={0.085}
        outlineColor="#617d6e"
      />
    </group>
  );
}
