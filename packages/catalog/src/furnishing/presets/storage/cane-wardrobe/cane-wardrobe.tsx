import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction/rounded-furniture-panel";
import { CaneDoor } from "./cane-door";

export function CaneWardrobe({ width }: { readonly width: number }) {
  const height = 2.15;
  const depth = 0.38;
  const doorWidth = width / 2 - 0.025;
  const frontZ = depth / 2 + 0.02;
  return (
    <group name="placard-cannage-couloir-custom" userData={{ walkCollider: true }}>
      <RoundedFurniturePanel
        size={[width - 0.11, height - 0.055, 0.035]}
        position={[0, (height - 0.055) / 2, -depth / 2 + 0.018]}
        color="#ded5ce"
        outline={false}
      />
      {[-1, 1].map((side) => (
        <RoundedFurniturePanel
          key={side}
          size={[0.055, height - 0.055, depth]}
          position={[side * (width / 2 - 0.0275), (height - 0.055) / 2, 0]}
          color="#e8dfd8"
          outlineColor="#aba098"
        />
      ))}
      <RoundedFurniturePanel
        size={[width, 0.055, depth]}
        position={[0, height - 0.0275, 0]}
        color="#e8dfd8"
        outlineColor="#aba098"
      />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (doorWidth / 2 + 0.0125), 0, 0]}>
          <CaneDoor width={doorWidth} height={height - 0.08} frontZ={frontZ} />
          <mesh
            position={[-side * (doorWidth / 2 - 0.055), 1.02, frontZ + 0.029]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.011, 0.016, 0.019, 12]} />
            <ToonMaterial color="#75614d" />
          </mesh>
          <mesh
            position={[-side * (doorWidth / 2 - 0.055), 1.02, frontZ + 0.0555]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.026, 0.019, 0.037, 16]} />
            <ToonMaterial color="#8b765d" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
