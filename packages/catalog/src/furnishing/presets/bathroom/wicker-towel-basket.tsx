import { Outlines, ToonMaterial } from "@cabane/engine";

export function WickerTowelBasket({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="wicker-towel-basket">
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.38, 0.24, 0.3]} />
        <ToonMaterial color="#a97952" />
        <Outlines color="#67462f" thickness={0.004} />
      </mesh>
      {[0.05, 0.1, 0.15, 0.2].map((y) => (
        <mesh key={y} position={[0, y, 0.154]}>
          <boxGeometry args={[0.35, 0.014, 0.012]} />
          <ToonMaterial color="#745039" />
        </mesh>
      ))}
      {[-0.11, 0, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.24, 12]} />
          <ToonMaterial color={color ?? "#eeeae1"} />
          <Outlines color="#9c9992" thickness={0.003} />
        </mesh>
      ))}
    </group>
  );
}
