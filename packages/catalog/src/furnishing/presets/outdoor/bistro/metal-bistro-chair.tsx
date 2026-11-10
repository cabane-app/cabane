import type { SceneModelProps } from "@cabane/engine";
import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../../construction";
import { FoldingFrameStrip as Strip } from "./folding-frame-strip";
export const METAL_BISTRO_CHAIR_SIZE = [0.4, 0.82, 0.5] as const;
export function MetalBistroChair({
  size = METAL_BISTRO_CHAIR_SIZE,
  color = "#b8c5ad",
}: Pick<SceneModelProps, "size" | "color">) {
  const slope = (-0.215 - 0.2375) / (0.812 - 0.018);
  const angle = Math.atan(slope);
  return (
    <group
      name="metal-bistro-chair"
      userData={{ walkCollider: true }}
      scale={[size[0] / 0.4, size[1] / 0.82, size[2] / 0.5]}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Panel
          key={i}
          name="bistro-chair-seat-slat"
          size={[0.4, 0.008, 0.068]}
          position={[0, 0.438, -0.166 + i * 0.078]}
          color={color}
          outlineColor="#77836f"
          radius={0.003}
        />
      ))}
      {[0.652, 0.785].map((y) => (
        <Panel
          key={y}
          name="bistro-chair-back-slat"
          size={[0.4, 0.076, 0.008]}
          position={[0, y, 0.2375 + slope * (y - 0.018)]}
          rotation={[angle, 0, 0]}
          color={color}
          outlineColor="#77836f"
          radius={0.003}
        />
      ))}
      {[-0.181, 0.181].map((x) => (
        <group key={x}>
          <Strip
            name="bistro-chair-seat-rail"
            color={color}
            from={[x, 0.429, -0.2]}
            to={[x, 0.429, 0.18]}
          />
          {[-0.2375, 0.2375].map((z) => (
            <mesh key={z} name="bistro-chair-foot" position={[x, 0.012, z]}>
              <boxGeometry args={[0.025, 0.024, 0.025]} />
              <ToonMaterial color="#303632" />
            </mesh>
          ))}
          <Strip
            color={color}
            name="bistro-chair-back-support"
            from={[x, 0.018, 0.2375]}
            to={[x, 0.812, -0.215]}
          />
          <Strip
            color={color}
            name="bistro-chair-seat-support"
            from={[x, 0.018, -0.2375]}
            to={[x, 0.434, 0.166]}
          />
          <mesh
            name="bistro-chair-hinge"
            position={[x, 0.3272, 0.0613]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.011, 0.011, 0.027, 12]} />
            <ToonMaterial color="#414741" />
          </mesh>
        </group>
      ))}
      {[-0.15, 0.166].map((z) => (
        <Panel
          key={z}
          name="bistro-chair-seat-crossbar"
          size={[0.38, 0.018, 0.022]}
          position={[0, 0.429, z]}
          color={color}
          radius={0.001}
        />
      ))}
    </group>
  );
}
