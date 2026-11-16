import { ToonMaterial } from "@cabane/engine";
import { KITCHEN_DARK, KitchenBox, KitchenPanel } from "./kitchen-finish";
import { RecessedPanel } from "./recessed-panel";

export function IntegratedMicrowave() {
  return (
    <group name="micro-ondes-integre-custom">
      <KitchenPanel width={0.553} height={0.178} position={[2.11, 2.133, 0.461]} />
      <KitchenBox
        size={[0.55, 0.46, 0.044]}
        position={[2.11, 1.806, 0.469]}
        color={KITCHEN_DARK}
        outline="#343530"
      />
      <RecessedPanel
        position={[2.062, 1.806, 0.491]}
        color="#555c58"
        rings={[
          [0.434, 0.406, -0.001],
          [0.43, 0.402, 0.005],
          [0.366, 0.315, 0.005],
          [0.35, 0.299, 0.001],
        ]}
      />
      <KitchenBox
        size={[0.345, 0.292, 0.003]}
        position={[2.062, 1.806, 0.494]}
        color="#394440"
        outline="#394440"
      />
      <KitchenBox
        size={[0.086, 0.384, 0.008]}
        position={[2.332, 1.806, 0.493]}
        color="#888981"
        outline="#72746e"
      />
      <KitchenBox
        size={[0.064, 0.049, 0.005]}
        position={[2.332, 1.926, 0.498]}
        color="#333e39"
        outline="#535b54"
      />
      <mesh position={[2.332, 1.747, 0.506]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.027, 0.029, 0.02, 16]} />
        <ToonMaterial color="#c2beb2" />
      </mesh>
    </group>
  );
}
