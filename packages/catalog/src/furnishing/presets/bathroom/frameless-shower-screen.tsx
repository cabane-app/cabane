import { ToonMaterial } from "@cabane/engine";
import { SHOWER_TRAY_WIDTH } from "./wide-shower-tray";

export function FramelessShowerScreen() {
  const railWidth = 0.035;
  const clampWidth = 0.06;
  return (
    <group name="frameless-walk-in-shower-screen">
      <mesh name="fixed-shower-glass" position={[0, 1.095, -0.006]}>
        <planeGeometry args={[SHOWER_TRAY_WIDTH, 2.1]} />
        <ToonMaterial color="#c6e0e3" transparent opacity={0.16} depthWrite={false} side={2} />
      </mesh>
      <mesh position={[1, 1.095, 0]} castShadow>
        <boxGeometry args={[railWidth, 2.1, 0.035]} />
        <ToonMaterial color="#6d7474" />
      </mesh>
      <mesh position={[-0.17, 2.115, -0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.84, 10]} />
        <ToonMaterial color="#747875" />
      </mesh>
      {[0.42, 1.74].map((height) => (
        <mesh key={height} position={[1 - (railWidth + clampWidth) / 2, height, 0.005]} castShadow>
          <boxGeometry args={[clampWidth, 0.09, 0.025]} />
          <ToonMaterial color="#747875" />
        </mesh>
      ))}
    </group>
  );
}
