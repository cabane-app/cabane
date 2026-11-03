import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const WOODEN_GARDEN_SWING_SIZE = [2.2, 2.1, 1.4] as const;
export function WoodenGardenSwing({
  size = WOODEN_GARDEN_SWING_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="wooden-garden-swing"
      scale={[size[0] / 2.2, size[1] / 2.1, size[2] / 1.4]}
      userData={{ walkCollider: true }}
    >
      {variant === "cozy" && (
        <group>
          <RoundedFurniturePanel
            name="swing-linen-seat-pad"
            size={[1.18, 0.075, 0.4]}
            position={[0, 0.5975, 0]}
            color={color ?? "#dfcfb1"}
            radius={0.03}
          />
          {[-0.36, 0, 0.36].map((x, i) => (
            <RoundedFurniturePanel
              key={x}
              name="swing-throw-cushion"
              size={[0.29, 0.12, 0.3]}
              position={[x, 0.76, -0.06]}
              rotation={[1.25, 0, i === 1 ? 0 : 0.1]}
              color={i === 1 ? "#bc8366" : "#92a181"}
              radius={0.05}
            />
          ))}
        </group>
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((side) => (
          <mesh
            name="swing-frame-leg"
            key={`${x}-${side}`}
            position={[x, 1.01, side * 0.32]}
            rotation={[-side * 0.307, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.1, 2.086, 0.1]} />
            <ToonMaterial color="#a87e4e" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        name="swing-crossbeam"
        size={[2.2, 0.12, 0.14]}
        position={[0, 2.04, 0]}
        color="#b58b59"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-foot"
        size={[0.18, 0.06, 1.4]}
        position={[-1, 0.03, 0]}
        color="#a87e4e"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-foot"
        size={[0.18, 0.06, 1.4]}
        position={[1, 0.03, 0]}
        color="#a87e4e"
        radius={0.006}
      />
      {[-0.57, 0.57].flatMap((x) =>
        [-0.18, 0.18].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.27, z]}>
            <cylinderGeometry args={[0.01, 0.01, 1.46, 8]} />
            <ToonMaterial color="#d7ccb0" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        name="swing-seat-slat"
        size={[1.3, 0.04, 0.085]}
        position={[0, 0.54, -0.18]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-slat"
        size={[1.3, 0.04, 0.085]}
        position={[0, 0.54, -0.09]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-slat"
        size={[1.3, 0.04, 0.085]}
        position={[0, 0.54, 0]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-slat"
        size={[1.3, 0.04, 0.085]}
        position={[0, 0.54, 0.09]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-slat"
        size={[1.3, 0.04, 0.085]}
        position={[0, 0.54, 0.18]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-back-slat"
        size={[1.3, 0.09, 0.04]}
        position={[0, 0.66, -0.205]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-back-slat"
        size={[1.3, 0.09, 0.04]}
        position={[0, 0.77, -0.205]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-back-slat"
        size={[1.3, 0.09, 0.04]}
        position={[0, 0.88, -0.205]}
        color="#c69c68"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-back-support"
        size={[0.05, 0.4, 0.05]}
        position={[-0.57, 0.72, -0.19]}
        color="#a87e4e"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-support"
        size={[0.06, 0.05, 0.48]}
        position={[-0.57, 0.505, 0]}
        color="#a87e4e"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-back-support"
        size={[0.05, 0.4, 0.05]}
        position={[0.57, 0.72, -0.19]}
        color="#a87e4e"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="swing-seat-support"
        size={[0.06, 0.05, 0.48]}
        position={[0.57, 0.505, 0]}
        color="#a87e4e"
        radius={0.006}
      />
    </group>
  );
}

export const GARDEN_SWING_VARIANTS = [
  { id: "default", label: "Bare timber" },
  { id: "cozy", label: "Linen, sage and clay cushions" },
];
