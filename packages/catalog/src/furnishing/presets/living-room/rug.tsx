import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
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
        size={[2, 0.01, 3]}
        position={[0, 0.005, 0]}
        color={color ?? "#d8cfbd"}
        radius={0.015}
        outlineColor="#9b907e"
      />
      {/* Border tops at 12 mm; bands top at 15 mm, avoiding coplanar faces. */}
      <mesh name="area-rug-border" position={[0, 0.011, 0]} receiveShadow>
        <boxGeometry args={[1.91, 0.002, 2.91]} />
        <ToonMaterial color={color ?? "#c5b79f"} />
      </mesh>
      {[-0.54, 0, 0.54].map((x) => (
        <mesh key={x} name="area-rug-band" position={[x, 0.013, 0]} receiveShadow>
          <boxGeometry args={[0.05, 0.004, 2.76]} />
          <ToonMaterial color="#aaa48d" />
        </mesh>
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
      {/* Field top is 13 mm. Every colored overlay is 2 mm thick and tops at 15 mm. */}
      <RoundedFurniturePanel
        name="area-rug-field"
        size={[2, 0.013, 3]}
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
