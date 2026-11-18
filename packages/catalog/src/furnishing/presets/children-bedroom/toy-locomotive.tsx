import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export function ToyLocomotive() {
  return (
    <group position={[0.015, 0.365, -0.025]}>
      <RoundedFurniturePanel
        size={[0.3, 0.036, 0.117]}
        position={[0, 0.058, 0]}
        radius={0.012}
        color="#aa8258"
        outline={false}
      />
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.043, 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.044, 0.044, 0.16, 14]} />
        <ToonMaterial color="#8eafa0" />
      </mesh>
      <RoundedFurniturePanel
        size={[0.105, 0.102, 0.091]}
        position={[-0.085, 0.122, 0]}
        radius={0.012}
        color="#d3aa6d"
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.134, 0.02, 0.128]}
        position={[-0.085, 0.18, 0]}
        radius={0.009}
        color="#9b6957"
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.056, 0.054, 0.003]}
        position={[-0.085, 0.134, -0.046]}
        radius={0.001}
        color="#736e61"
        outline={false}
      />
      <mesh position={[0.09, 0.159, 0]}>
        <cylinderGeometry args={[0.026, 0.015, 0.063, 10]} />
        <ToonMaterial color="#b38257" />
      </mesh>
      {[-0.09, 0, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.036, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.036, 0.036, 0.139, 14]} />
          <ToonMaterial color="#675448" />
        </mesh>
      ))}
    </group>
  );
}
