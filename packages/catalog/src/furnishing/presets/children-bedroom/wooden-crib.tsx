import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { cribEnd, cribSpindles } from "./crib-joinery";

export const WOODEN_CRIB_SIZE = [0.76, 0.95, 1.46] as const;

/** Generic 70 × 140 cm cot with slatted oak sides and neutral bedding. */
export function WoodenCrib({
  size = WOODEN_CRIB_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="wooden-crib"
      scale={[size[0] / 0.76, size[1] / 0.95, size[2] / 1.46]}
      userData={{ walkCollider: true }}
    >
      {[-0.35, 0.35].flatMap((x) =>
        [-0.7, 0.7].map((z) => (
          <RoundedFurniturePanel
            key={x + "-" + z}
            name="crib-post"
            position={[x, 0.449, z]}
            size={[0.06, 0.898, 0.06]}
            color="#c89f6d"
            radius={0.013}
            outline={false}
          />
        )),
      )}
      {[-0.72, 0.68].map((z) => (
        <mesh
          name="crib-end"
          key={z}
          position-z={z}
          geometry={cribEnd}
          dispose={null}
          castShadow
          receiveShadow
        >
          <ToonMaterial color="#d4b17e" />
          <Outlines color="#ab895d" thickness={0.0015} screenspace={false} />
        </mesh>
      ))}
      {[-0.357, 0.357].map((x) => (
        <group key={x} position-x={x}>
          <mesh
            name="crib-side-slats"
            geometry={cribSpindles}
            dispose={null}
            castShadow
            receiveShadow
          >
            <ToonMaterial color="#c8a06e" />
          </mesh>
          <RoundedFurniturePanel
            name="crib-bottom-rail"
            size={[0.039, 0.094, 1.362]}
            position={[0, 0.312, 0]}
            color="#c39b6b"
            radius={0.008}
            outline={false}
          />
          <RoundedFurniturePanel
            name="crib-top-rail"
            size={[0.046, 0.051, 1.362]}
            position={[0, 0.861, 0]}
            color="#d0aa77"
            radius={0.018}
            outlineColor="#aa875b"
          />
        </group>
      ))}
      <mesh position={[0, 0.304, 0]} receiveShadow>
        <boxGeometry args={[0.705, 0.025, 1.39]} />
        <ToonMaterial color="#bc986c" />
      </mesh>
      <RoundedFurniturePanel
        name="crib-mattress-70x140"
        size={[0.7, 0.14, 1.4]}
        position={[0, 0.38, 0]}
        color="#f1ece0"
        radius={0.035}
        outlineColor="#bbb29e"
      />
      <RoundedFurniturePanel
        name="crib-blanket"
        size={[0.66, 0.036, 0.66]}
        position={[0, 0.466, 0.29]}
        color={color ?? "#d8d3bd"}
        radius={0.016}
        outlineColor="#ada793"
      />
      <RoundedFurniturePanel
        name="crib-folded-hem"
        size={[0.65, 0.026, 0.103]}
        position={[0, 0.487, 0.009]}
        color={color ?? "#dfdbc8"}
        radius={0.012}
        outline={false}
      />
    </group>
  );
}
