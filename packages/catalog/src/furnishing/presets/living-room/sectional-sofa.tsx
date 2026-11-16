import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { SectionalBackCushion } from "./sectional-back-cushion";
import { CozySofaCushions, TailoredCushion } from "./sofa-upholstery";

/** Existing sectional envelope and offset origin retained for saved placements. */
export function CustomSectionalSofa({
  variant = "default",
  color,
}: { variant?: string | undefined; color?: string | undefined } = {}) {
  const mirrored = variant === "right" || variant === "cozy-right" || variant === "sage-right";
  const cozy =
    variant === "cozy" ||
    variant === "cozy-right" ||
    variant === "sage" ||
    variant === "sage-right";
  return (
    <group
      name="canape-salon-custom"
      scale={[mirrored ? -1 : 1, 1, 1]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="two-seat-upholstered-deck"
        size={[1.82, 0.32, 0.72]}
        position={[0.45, 0.31, 0.02]}
        color={color ?? "#d2ccbd"}
        radius={0.055}
      />
      <RoundedFurniturePanel
        size={[0.88, 0.32, 1.56]}
        position={[-0.91, 0.31, 0.43]}
        color={color ?? "#d2ccbd"}
        radius={0.055}
      />
      <RoundedFurniturePanel
        name="upholstered-back-frame"
        size={[2.55, 0.65, 0.16]}
        position={[0, 0.675, -0.33]}
        color={color ?? "#d2ccbd"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="oak-front-rail"
        size={[1.77, 0.055, 0.64]}
        position={[0.455, 0.1575, 0.02]}
        color="#ad895b"
        radius={0.012}
      />
      <RoundedFurniturePanel
        name="oak-chaise-rail"
        size={[0.82, 0.055, 1.48]}
        position={[-0.91, 0.1575, 0.43]}
        color="#ad895b"
        radius={0.012}
      />
      <TailoredCushion
        name="chaise-seat-cushion"
        size={[0.84, 0.2, 1.39]}
        position={[-0.91, 0.57, 0.39]}
        color={color ?? "#eee7d8"}
      />
      {[-0.02, 0.84].map((x) => (
        <TailoredCushion
          key={x}
          name="sectional-seat-cushion"
          size={[0.8, 0.2, 0.63]}
          position={[x, 0.57, 0.08]}
          color={color ?? "#e9e4d7"}
        />
      ))}
      {[-0.91, -0.02, 0.84].map((x) => (
        <SectionalBackCushion key={x} x={x} color={color ?? "#e9e4d7"} />
      ))}
      {[-1.37, 1.37].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            name="sectional-arm"
            size={[0.19, 0.59, 0.86]}
            position={[x, 0.455, 0.01]}
            color={color ?? "#ded9ca"}
            radius={0.065}
          />
          <TailoredCushion
            name="sectional-arm-pad"
            size={[0.18, 0.13, 0.84]}
            position={[x, 0.765, 0.01]}
            color={color ?? "#eee7d8"}
          />
        </group>
      ))}
      {cozy && <CozySofaCushions sage={variant.startsWith("sage")} />}
      {[
        [-1.23, -0.25],
        [-0.55, -0.25],
        [0.48, -0.25],
        [1.23, -0.25],
        [-1.23, 1.04],
        [-0.58, 1.04],
        [0.48, 0.27],
        [1.23, 0.27],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.085, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.035, 0.17, 10]} />
          <ToonMaterial color="#b38d59" />
        </mesh>
      ))}
    </group>
  );
}
