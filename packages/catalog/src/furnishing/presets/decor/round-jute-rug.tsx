import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
export const ROUND_JUTE_RUG_SIZE = [2, 0.018, 2] as const;
/** Coiled rope relief, with no printed concentric outline. */
export function RoundJuteRug({
  size = ROUND_JUTE_RUG_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group scale={[size[0] / 2, size[1] / 0.018, size[2] / 2]}>
      <mesh position={[0, 0.007, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.014, 96]} />
        <ToonMaterial color={color ?? "#c7ae7d"} />
      </mesh>
      {Array.from({ length: 48 }, (_, i) => (
        <mesh key={i} position={[0, 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <torusGeometry args={[0.014 + i * 0.0208, 0.004, 6, 96]} />
          <ToonMaterial
            color={color ?? (i % 3 === 0 ? "#cbb382" : i % 3 === 1 ? "#cdb584" : "#c9b180")}
          />
        </mesh>
      ))}
    </group>
  );
}
