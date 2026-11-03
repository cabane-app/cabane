import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const UPHOLSTERED_ARMCHAIR_SIZE = [0.85, 0.9, 0.88] as const;

/** Neutral upholstered armchair with a separate seat, back, arms, and oak feet. */
export function UpholsteredArmchair({
  size = UPHOLSTERED_ARMCHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="upholstered-armchair"
      scale={[size[0] / 0.85, size[1] / 0.9, size[2] / 0.88]}
      userData={{ walkCollider: true }}
    >
      {[-0.31, 0.31].flatMap((x) =>
        [-0.32, 0.32].map((z) => (
          <mesh key={`${x}-${z}`} name="armchair-foot" position={[x, 0.07, z]} castShadow>
            <boxGeometry args={[0.06, 0.14, 0.06]} />
            <ToonMaterial color="#a87d50" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.77, 0.19, 0.76]}
        position={[0, 0.245, 0.03]}
        color={color ?? "#c8b9a2"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="armchair-seat"
        size={[0.56, 0.15, 0.58]}
        position={[0, 0.405, 0.09]}
        color={color ?? "#dfd2bc"}
        radius={0.055}
      />
      {[-0.335, 0.335].map((x) => (
        <RoundedFurniturePanel
          key={x}
          name="armchair-arm"
          size={[0.18, 0.58, 0.88]}
          position={[x, 0.36, 0]}
          color={color ?? "#d2c4ad"}
          radius={0.07}
        />
      ))}
      <RoundedFurniturePanel
        name="armchair-back"
        size={[0.67, 0.63, 0.16]}
        position={[0, 0.585, -0.36]}
        color={color ?? "#d9ccb6"}
        radius={0.06}
      />
      <RoundedFurniturePanel
        name="armchair-back-cushion"
        size={[0.54, 0.48, 0.12]}
        position={[0, 0.61, -0.265]}
        color={color ?? "#e4d8c5"}
        radius={0.055}
      />
    </group>
  );
}
