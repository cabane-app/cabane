import { ToonMaterial, RoundedBox } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { TaperedChangingLeg } from "./tapered-changing-leg";
import { WickerFront } from "./wicker-front";
import { CREAM, CREAM_LIGHT, OUTLINE } from "./changing-table-finish";

export function ChangingTable({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="meuble-a-langer-bedroom-two-custom" userData={{ walkCollider: true }}>
      {[-0.31, 0.31].flatMap((x) =>
        [-0.15, 0.15].map((z) => <TaperedChangingLeg key={`${x}-${z}`} x={x} z={z} />),
      )}
      <RoundedFurniturePanel
        size={[0.74, 0.57, 0.42]}
        position={[0, 0.48, 0]}
        color={CREAM}
        radius={0.018}
        outlineColor={OUTLINE}
      />
      <RoundedFurniturePanel
        size={[0.625, 0.13, 0.03]}
        position={[0, 0.658, 0.215]}
        color="#dfd8cf"
        outline={false}
        radius={0.013}
      />
      <RoundedFurniturePanel
        size={[0.59, 0.105, 0.018]}
        position={[0, 0.656, 0.231]}
        color={CREAM_LIGHT}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.14, 0.023, 0.025]}
        position={[0, 0.668, 0.2495]}
        color="#ad9478"
        radius={0.01}
        outline={false}
      />
      <WickerFront />
      <RoundedFurniturePanel
        size={[0.81, 0.075, 0.47]}
        position={[0, 0.79, 0]}
        color={CREAM_LIGHT}
        radius={0.018}
        outlineColor={OUTLINE}
      />
      <RoundedBox
        args={[0.685, 0.066, 0.39]}
        radius={0.03}
        smoothness={2}
        bevelSegments={1}
        position={[0, 0.854, 0.005]}
        castShadow
        receiveShadow
      >
        <ToonMaterial color={color ?? "#dfbbb7"} map={linenWeaveTexture} />
      </RoundedBox>
      {[-0.313, 0.313].map((x) => (
        <RoundedBox
          key={x}
          args={[0.088, 0.086, 0.384]}
          radius={0.04}
          smoothness={2}
          bevelSegments={1}
          position={[x, 0.901, 0.005]}
          castShadow
          receiveShadow
        >
          <ToonMaterial color={color ?? "#efd7d1"} map={linenWeaveTexture} />
        </RoundedBox>
      ))}
      {[-0.168, 0.178].map((z) => (
        <RoundedFurniturePanel
          key={z}
          size={[0.58, 0.045, 0.046]}
          position={[0, 0.884, z]}
          color={color ?? "#efd7d1"}
          outline={false}
          radius={0.021}
        />
      ))}
    </group>
  );
}
