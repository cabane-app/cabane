import { Outlines, ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { ToyShelfCase } from "./toy-shelf-case";
import { ToyLocomotive } from "./toy-locomotive";

function ShelfBear() {
  return (
    <group position={[-0.055, 0.73, 0]}>
      <mesh position={[0, 0.055, 0]} scale={[0.08, 0.09, 0.065]} castShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <ToonMaterial color="#c88e78" />
        <Outlines color="#6f5147" thickness={0.0012} screenspace={false} />
      </mesh>
      <mesh position={[0, 0.16, 0]} scale={[0.065, 0.06, 0.055]} castShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <ToonMaterial color="#d19a83" />
      </mesh>
      <mesh position={[0, 0.143, -0.047]} scale={[0.035, 0.024, 0.02]}>
        <sphereGeometry args={[1, 10, 8]} />
        <ToonMaterial color="#e6c5ac" />
      </mesh>
      {[-0.024, 0.024].map((x) => (
        <mesh key={x} position={[x, 0.174, -0.05]}>
          <sphereGeometry args={[0.007, 8, 6]} />
          <ToonMaterial color="#503f38" />
        </mesh>
      ))}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]}>
          <sphereGeometry args={[0.025, 10, 8]} />
          <ToonMaterial color="#b77868" />
        </mesh>
      ))}
    </group>
  );
}

function StackingToy() {
  return (
    <group position={[-0.02, 0.05, 0]}>
      <RoundedFurniturePanel
        size={[0.18, 0.027, 0.14]}
        position={[0, 0.0135, 0]}
        radius={0.01}
        color="#c39b6e"
        outline={false}
      />
      {[0.055, 0.045, 0.035].map((radius, index) => (
        <mesh
          key={radius}
          position={[0, 0.044 + index * 0.035, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[radius, 0.018, 7, 18]} />
          <ToonMaterial color={["#d49590", "#ddb873", "#90aa9d"][index]} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.01, 0.014, 0.156, 8]} />
        <ToonMaterial color="#9b6f48" />
      </mesh>
    </group>
  );
}

export function ChildrenBedroomNarrowToyShelf() {
  return (
    <group name="etagere-jouets-etroite-photo" userData={{ walkCollider: true }}>
      <ToyShelfCase />
      <StackingToy />
      <ToyLocomotive />
      <ShelfBear />
    </group>
  );
}
