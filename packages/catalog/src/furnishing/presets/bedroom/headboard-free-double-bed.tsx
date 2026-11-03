import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const HEADBOARD_FREE_DOUBLE_BED_SIZE = [1.64, 0.66, 2.04] as const;

/** Generic photo-derived proportions; no manufacturer dimensions are claimed. */
export function HeadboardFreeDoubleBed({
  size = HEADBOARD_FREE_DOUBLE_BED_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="headboard-free-double-bed"
      scale={[size[0] / 1.64, size[1] / 0.66, size[2] / 2.04]}
      userData={{ walkCollider: true }}
    >
      {[-0.7, 0.7].flatMap((x) =>
        [-0.9, 0.9].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.1, z]}>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <ToonMaterial color="#dfddd5" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel size={[1.64, 0.2, 2.04]} position={[0, 0.25, 0]} color="#e6e3da" />
      <RoundedFurniturePanel
        size={[1.6, 0.22, 2]}
        position={[0, 0.45, 0]}
        color="#f3f0e7"
        radius={0.035}
      />
      <RoundedFurniturePanel
        size={[1.64, 0.09, 1.55]}
        position={[0, 0.565, 0.245]}
        color={color ?? "#ded9cd"}
        radius={0.04}
      />
      {[-0.4, 0.4].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.69, 0.1, 0.43]}
          position={[x, 0.61, -0.72]}
          color={color ?? "#e7e2d6"}
          radius={0.04}
        />
      ))}
    </group>
  );
}
