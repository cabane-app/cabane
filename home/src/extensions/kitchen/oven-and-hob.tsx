import { ToonMaterial } from "@cabane/engine";
import { KITCHEN_DARK, KitchenBox } from "./kitchen-finish";
import { RecessedPanel } from "./recessed-panel";

export function OvenAndHob() {
  return (
    <group name="four-et-plaque-induction-custom">
      <KitchenBox
        size={[0.568, 0.734, 0.04]}
        position={[1.09, 0.465, 0.601]}
        color={KITCHEN_DARK}
        outline="#302e2d"
      />
      <RecessedPanel
        position={[1.09, 0.374, 0.623]}
        color="#5b605c"
        rings={[
          [0.529, 0.483, -0.004],
          [0.522, 0.476, 0.006],
          [0.447, 0.38, 0.006],
          [0.431, 0.364, -0.001],
        ]}
      />
      <KitchenBox
        size={[0.419, 0.35, 0.005]}
        position={[1.09, 0.374, 0.624]}
        color="#353e3c"
        outline="#353e3c"
      />
      <KitchenBox
        size={[0.535, 0.126, 0.014]}
        position={[1.09, 0.755, 0.627]}
        color="#a9a59c"
        outline="#807d75"
      />
      {[0.911, 1.269].map((x) => (
        <mesh key={x} position={[x, 0.755, 0.644]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.035, 0.025, 16]} />
          <ToonMaterial color="#525551" />
        </mesh>
      ))}
      <KitchenBox
        size={[0.168, 0.049, 0.006]}
        position={[1.09, 0.755, 0.636]}
        color="#36413f"
        outline="#484943"
      />
      {[0.902, 1.278].map((x) => (
        <KitchenBox
          key={x}
          size={[0.021, 0.025, 0.044]}
          position={[x, 0.647, 0.641]}
          color="#656963"
          outline="#676961"
        />
      ))}
      <mesh position={[1.09, 0.647, 0.662]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.014, 0.423, 2, 10]} />
        <ToonMaterial color="#aaa99c" />
      </mesh>
      <KitchenBox
        size={[0.508, 0.013, 0.432]}
        position={[1.09, 0.923, 0.34]}
        color="#252827"
        outline="#393c38"
      />
      {[
        [0.975, 0.245, 0.084],
        [1.204, 0.237, 0.066],
        [0.974, 0.44, 0.064],
        [1.205, 0.43, 0.089],
      ].map(([x, z, r]) => (
        <mesh key={x} position={[x!, 0.9304, z!]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r! - 0.0035, r!, 32]} />
          <ToonMaterial color="#777c74" />
        </mesh>
      ))}
    </group>
  );
}
