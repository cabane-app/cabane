import type { SceneModelProps } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../construction/rounded-furniture-panel";
export function PianoBench({ size, color }: SceneModelProps) {
  return (
    <group
      name="piano-bench"
      userData={{ walkCollider: true }}
      scale={[size[0] / 0.6, size[1] / 0.48, size[2] / 0.32]}
    >
      <Panel
        size={[0.6, 0.06, 0.32]}
        position={[0, 0.45, 0]}
        color={color ?? "#292b2c"}
        radius={0.025}
      />
      {[-0.23, 0.23].flatMap((x) =>
        [-0.1, 0.1].map((z) => (
          <Panel
            key={`${x}-${z}`}
            size={[0.04, 0.42, 0.04]}
            position={[x, 0.21, z]}
            color="#24282b"
          />
        )),
      )}
    </group>
  );
}
