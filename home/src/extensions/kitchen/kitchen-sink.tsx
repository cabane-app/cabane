import { ToonMaterial } from "@cabane/engine";
import { KITCHEN_BRASS } from "./kitchen-finish";
import { RecessedPanel } from "./recessed-panel";

export function KitchenSink() {
  return (
    <group name="evier-et-robinet-custom">
      <RecessedPanel
        position={[2.55, 0.9175, 0.34]}
        rotation={[-Math.PI / 2, 0, 0]}
        color="#abb6b1"
        rings={[
          [0.55, 0.39, -0.003],
          [0.546, 0.386, 0.005],
          [0.469, 0.312, 0.005],
          [0.453, 0.296, -0.008],
          [0.404, 0.242, -0.119],
          [0.373, 0.218, -0.129],
        ]}
      />
      <mesh position={[2.55, 0.79, 0.34]}>
        <cylinderGeometry args={[0.031, 0.031, 0.005, 20]} />
        <ToonMaterial color="#68736e" />
      </mesh>
      <mesh position={[2.55, 0.793, 0.34]}>
        <cylinderGeometry args={[0.017, 0.017, 0.003, 16]} />
        <ToonMaterial color="#46534e" />
      </mesh>
      <group position={[2.55, 0.9175, 0.113]}>
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.032, 0.04, 0.028, 20]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
        <mesh position={[0, 0.132, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.021, 0.224, 16]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
        <mesh position={[0, 0.244, 0.094]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.094, 0.014, 8, 20, Math.PI]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
        <mesh position={[0, 0.221, 0.188]}>
          <cylinderGeometry args={[0.014, 0.018, 0.05, 16]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
        <mesh position={[0.028, 0.083, 0]} rotation={[0, 0, -0.53]}>
          <capsuleGeometry args={[0.009, 0.083, 2, 8]} />
          <ToonMaterial color={KITCHEN_BRASS} />
        </mesh>
      </group>
    </group>
  );
}
