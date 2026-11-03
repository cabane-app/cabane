import type { SceneModelProps } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../construction/rounded-furniture-panel";
export function SlattedSingleBed({ size, color }: SceneModelProps) {
  return (
    <group
      name="slatted-single-bed"
      userData={{ walkCollider: true }}
      scale={[size[0] / 0.98, size[1] / 0.73, size[2] / 2.08]}
    >
      {[-0.46, 0.46].flatMap((x) =>
        [-1, 1].map((z) => (
          <Panel
            key={`${x}-${z}`}
            size={[0.06, 0.73, 0.08]}
            position={[x, 0.365, z]}
            color="#f0eee8"
            radius={0.003}
          />
        )),
      )}
      {[-0.46, 0.46].map((x) => (
        <Panel key={x} size={[0.04, 0.16, 2]} position={[x, 0.29, 0]} color="#efede7" />
      ))}
      {[-1, 1].map((z) => (
        <Panel key={z} size={[0.86, 0.1, 0.04]} position={[0, 0.66, z]} color="#f0eee8" />
      ))}
      <Panel size={[0.9, 0.08, 2]} position={[0, 0.29, 0]} color="#c5b495" />
      <Panel size={[0.9, 0.16, 2]} position={[0, 0.41, 0]} color="#f1eadf" radius={0.025} />
      <Panel
        size={[0.88, 0.035, 1.55]}
        position={[0, 0.5075, 0.21]}
        color={color ?? "#e2c9ce"}
        radius={0.009}
      />
      <Panel
        size={[0.7, 0.12, 0.4]}
        position={[0, 0.54, -0.74]}
        color={color ?? "#e5dfcc"}
        radius={0.035}
      />
      <Panel size={[0.025, 0.14, 1]} position={[0.46, 0.6, -0.44]} color="#f0eee8" />
    </group>
  );
}
