import { RoundedFurniturePanel } from "../../construction";
import { ToonMaterial } from "@cabane/engine";

export function FoxFabricBin({ color }: { color?: string | undefined } = {}) {
  return (
    <group position={[-0.195, 0.565, 0.04]}>
      <RoundedFurniturePanel
        size={[0.31, 0.28, 0.285]}
        color={color ?? "#a95f59"}
        radius={0.017}
        outlineColor="#85554f"
      />
      {[-0.095, 0.095].map((x) => (
        <mesh key={x} position={[x, 0.102, 0.134]} rotation={[0, 0, x < 0 ? -0.22 : 0.22]}>
          <coneGeometry args={[0.049, 0.093, 4]} />
          <ToonMaterial color={color ?? "#a95f59"} />
        </mesh>
      ))}
      {[-0.065, 0.065].map((x) => (
        <mesh key={x} position={[x, 0.045, 0.15]}>
          <sphereGeometry args={[0.014, 10, 6]} />
          <ToonMaterial color="#3f3634" />
        </mesh>
      ))}
      <mesh position={[0, -0.035, 0.15]} scale={[1.35, 0.75, 0.55]}>
        <sphereGeometry args={[0.07, 14, 8]} />
        <ToonMaterial color="#ead9ca" />
      </mesh>
      <mesh position={[0, -0.025, 0.191]}>
        <sphereGeometry args={[0.012, 10, 6]} />
        <ToonMaterial color="#4a3b39" />
      </mesh>
    </group>
  );
}
