import { Outlines, ToonMaterial } from "@cabane/engine";
import { TaperedChangingLeg } from "./tapered-changing-leg";
import { WickerFront } from "./wicker-front";
import { CREAM, CREAM_LIGHT, OUTLINE } from "./changing-table-finish";

export function ChangingTable({ color }: { color?: string | undefined } = {}) {
  const legs = [
    [-0.31, -0.15],
    [0.31, -0.15],
    [-0.31, 0.15],
    [0.31, 0.15],
  ] as const;

  return (
    <group name="meuble-a-langer-bedroom-two-custom" userData={{ walkCollider: true }}>
      {legs.map(([x, z]) => (
        <TaperedChangingLeg key={`${x}-${z}`} x={x} z={z} />
      ))}

      <mesh position={[0, 0.49, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 0.57, 0.42]} />
        <ToonMaterial color={CREAM} />
        <Outlines color={OUTLINE} thickness={0.006} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.65, 0.224]}>
        <boxGeometry args={[0.6, 0.12, 0.02]} />
        <ToonMaterial color="#e5dfd7" />
      </mesh>
      <mesh position={[0, 0.715, 0.229]}>
        <boxGeometry args={[0.24, 0.018, 0.012]} />
        <ToonMaterial color="#b4a99d" />
      </mesh>
      <WickerFront />

      <mesh position={[0, 0.79, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.81, 0.075, 0.47]} />
        <ToonMaterial color={CREAM_LIGHT} />
        <Outlines color={OUTLINE} thickness={0.006} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.852, 0.005]} castShadow>
        <boxGeometry args={[0.67, 0.055, 0.385]} />
        <ToonMaterial color={color ?? "#dfbbb7"} />
      </mesh>
      {[-0.325, 0.325].map((x) => (
        <mesh key={x} position={[x, 0.91, 0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.034, 0.31, 6, 12]} />
          <ToonMaterial color={color ?? "#efd7d1"} />
          <Outlines color="#9d7773" thickness={0.004} screenspace={false} />
        </mesh>
      ))}
      {[-0.17, 0.17].map((z) => (
        <mesh key={z} position={[0, 0.895, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.025, 0.58, 5, 12]} />
          <ToonMaterial color={color ?? "#efd7d1"} />
        </mesh>
      ))}
    </group>
  );
}
