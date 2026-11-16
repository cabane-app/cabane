import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RugSelvedge } from "./rug-selvedge";
import { FluffyRugLayers } from "./fluffy-rug-layers";
import { RoundedFurniturePanel } from "../construction";

export const NEUTRAL_AREA_RUG_SIZE = [2, 0.015, 3] as const;

import { COLORFUL_RUG_VARIANTS } from "./rug-patterns";
type ColorfulRugVariant = keyof typeof COLORFUL_RUG_VARIANTS;

const isColorfulRugVariant = (variant: string): variant is ColorfulRugVariant =>
  Object.hasOwn(COLORFUL_RUG_VARIANTS, variant);

function NeutralRugLayers({ color }: { color?: string | undefined }) {
  return (
    <>
      <RoundedFurniturePanel
        name="area-rug-field"
        size={[2, 0.01, 2.934]}
        position={[0, 0.005, 0]}
        color={color ?? "#d8cfbd"}
        radius={0.015}
        outline={false}
      />
      <RugSelvedge color={color ?? "#d4c8b3"} />
      {/* Border tops at 12 mm; bands top at 15 mm, avoiding coplanar faces. */}
      <mesh name="area-rug-border" position={[0, 0.011, 0]} receiveShadow>
        <boxGeometry args={[1.91, 0.002, 2.91]} />
        <ToonMaterial color={color ?? "#c5b79f"} />
      </mesh>
      {[-0.74, 0.74].map((x) => (
        <group key={x}>
          {[-0.055, 0, 0.055].map((offset, j) => (
            <mesh key={offset} position={[x + offset, 0.013, 0]} receiveShadow>
              <boxGeometry args={[j === 1 ? 0.043 : 0.014, 0.004, 2.77]} />
              <ToonMaterial color={j === 1 ? "#aaa48d" : "#d6c8af"} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.85, 0, 0.85].map((z) => (
        <group key={z} position={[0, 0.013, z]}>
          {[-1, 1].flatMap((side) =>
            [-1, 1].map((slope) => (
              <mesh
                key={side + ":" + slope}
                position={[side * 0.113, 0, slope * 0.153]}
                rotation={[0, -side * slope * 0.635, 0]}
                receiveShadow
              >
                <boxGeometry args={[0.018, 0.004, 0.365]} />
                <ToonMaterial color="#aaa48d" />
              </mesh>
            )),
          )}
        </group>
      ))}
    </>
  );
}

function ColorfulRugLayers({
  variant,
  color,
}: {
  variant: ColorfulRugVariant;
  color?: string | undefined;
}) {
  const style = COLORFUL_RUG_VARIANTS[variant];
  return (
    <>
      <RugSelvedge color={color ?? style.field} />
      {/* Field top is 13 mm. Every colored overlay is 2 mm thick and tops at 15 mm. */}
      <RoundedFurniturePanel
        name="area-rug-field"
        size={[2, 0.013, 2.934]}
        position={[0, 0.0065, 0]}
        color={color ?? style.field}
        radius={0.015}
        outline={false}
      />
      {[-0.945, 0.945].map((x) => (
        <mesh key={`side-${x}`} name="area-rug-border-side" position={[x, 0.014, 0]} receiveShadow>
          <boxGeometry args={[0.06, 0.002, 2.91]} />
          <ToonMaterial color={style.border} />
        </mesh>
      ))}
      {[-1.425, 1.425].map((z) => (
        <mesh key={`end-${z}`} name="area-rug-border-end" position={[0, 0.014, z]} receiveShadow>
          <boxGeometry args={[1.83, 0.002, 0.06]} />
          <ToonMaterial color={style.border} />
        </mesh>
      ))}
      {style.blocks.map(([x, z, width, depth, color, angle = 0], index) => (
        <mesh
          key={`${variant}-${index}`}
          name={`area-rug-${variant}-block`}
          position={[x, 0.014, z]}
          rotation={[0, angle, 0]}
          receiveShadow
        >
          <boxGeometry args={[width, 0.002, depth]} />
          <ToonMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

/** Thin code-native rug with woven and patterned styles; legacy export names stay stable. */
export function NeutralAreaRug({
  size = NEUTRAL_AREA_RUG_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group name="neutral-area-rug" scale={[size[0] / 2, size[1] / 0.015, size[2] / 3]}>
      {variant === "fluffy" ? (
        <FluffyRugLayers color={color} />
      ) : isColorfulRugVariant(variant) ? (
        <ColorfulRugLayers variant={variant} color={color} />
      ) : (
        <NeutralRugLayers color={color} />
      )}
    </group>
  );
}
