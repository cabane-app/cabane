import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const SIX_DOOR_OAK_SIDEBOARD_SIZE = [3, 0.74, 0.42] as const;
/** Generic proportions inferred from reference appearance, not manufacturer measurements. */
export function SixDoorOakSideboard({
  size = SIX_DOOR_OAK_SIDEBOARD_SIZE,
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  return (
    <group
      name="six-door-oak-sideboard"
      scale={[size[0] / 3, size[1] / 0.74, size[2] / 0.42]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        grain="x"
        size={[3, 0.7, 0.37]}
        position={[0, 0.35, -0.025]}
        color="#bd986c"
        radius={0.003}
      />
      <RoundedFurniturePanel
        grain="x"
        size={[3, 0.04, 0.42]}
        position={[0, 0.72, 0]}
        color="#c7a67b"
        radius={0.003}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          <RoundedFurniturePanel
            grain="y"
            name="oak-sideboard-door"
            size={[0.494, 0.66, 0.024]}
            position={[-1.25 + i * 0.5, 0.35, 0.175]}
            color={i % 2 ? "#c5a277" : "#caa87d"}
            radius={0.003}
          />
          <mesh
            position={[-1.25 + i * 0.5 + (i % 2 === 0 ? 0.2 : -0.2), 0.61, 0.2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.014, 0.014, 0.02, 16]} />
            <ToonMaterial color="#282b28" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
