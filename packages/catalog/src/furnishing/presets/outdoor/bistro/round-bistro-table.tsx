import { Outlines, ToonMaterial, type SceneModelProps } from "@cabane/engine";
import { FoldingFrameStrip as Strip } from "./folding-frame-strip";
export const ROUND_BISTRO_TABLE_SIZE = [0.7, 0.72, 0.7] as const;
export function RoundBistroTable({
  size = ROUND_BISTRO_TABLE_SIZE,
  color = "#b8c5ad",
}: Pick<SceneModelProps, "size" | "color">) {
  return (
    <group
      name="round-bistro-table"
      scale={[size[0] / 0.7, size[1] / 0.72, size[2] / 0.7]}
      userData={{ walkCollider: true }}
    >
      <mesh name="bistro-table-solid-top" position={[0, 0.714, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.012, 64]} />
        <ToonMaterial color={color} />
        <Outlines color="#77836f" thickness={0.001} screenspace={false} />
      </mesh>
      {[-0.19, 0.19].map((x) => (
        <group key={x}>
          {[-0.24, 0.24].map((z) => (
            <mesh key={z} position={[x, 0.009, z]}>
              <boxGeometry args={[0.022, 0.018, 0.028]} />
              <ToonMaterial color="#737a6e" />
            </mesh>
          ))}
          <Strip
            name="bistro-table-cross-leg"
            color={color}
            from={[x - 0.009, 0.015, -0.24]}
            to={[x - 0.009, 0.704, 0.24]}
          />
          <Strip
            name="bistro-table-cross-leg"
            color={color}
            from={[x + 0.009, 0.015, 0.24]}
            to={[x + 0.009, 0.704, -0.24]}
          />
          <mesh position={[x, 0.3595, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.042, 12]} />
            <ToonMaterial color={color} />
          </mesh>
        </group>
      ))}
      {[-0.24, 0.24].map((z) => (
        <group key={z}>
          <Strip
            name="bistro-table-top-brace"
            color={color}
            from={[-0.205, 0.704, z]}
            to={[0.205, 0.704, z]}
          />
          <Strip
            name="bistro-table-low-brace"
            color={color}
            from={[-0.19, 0.06, z * 0.87]}
            to={[0.19, 0.06, z * 0.87]}
          />
        </group>
      ))}
    </group>
  );
}
