import { ShowerHose } from "./shower-hose";
import { Outlines, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";
import { RoundedFurniturePanel } from "../construction";

const handset = [
  [0, -0.239],
  [0.019, -0.239],
  [0.022, -0.232],
  [0.021, -0.115],
  [0.025, -0.012],
  [0.038, 0.025],
  [0.063, 0.066],
  [0.071, 0.111],
  [0.069, 0.153],
  [0.057, 0.184],
  [0.031, 0.2],
  [0, 0.203],
].map(([r, y]) => new Vector2(r, y));

export function ShowerColumn() {
  const metal = "#4c4d4b";
  const metalLight = "#747875";
  const edge = "#262725";
  return (
    <group name="wall-mounted-rain-shower-column">
      <mesh position={[-0.055, 1.64, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.28, 12]} />
        <ToonMaterial color={metalLight} />
        <Outlines thickness={0.0015} color={edge} screenspace={false} />
      </mesh>
      {[1.28, 1.98].map((height) => (
        <mesh
          key={height}
          position={[-0.0175, height, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.014, 0.014, 0.075, 10]} />
          <ToonMaterial color={metalLight} />
        </mesh>
      ))}
      <RoundedFurniturePanel
        name="thermostatic-mixing-bar"
        radius={0.041}
        size={[0.11, 0.105, 0.46]}
        position={[-0.09, 1.03, 0]}
        color={metal}
        outlineColor="#525752"
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[-0.095, 1.03, side * 0.2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.055, 0.055, 0.055, 12]} />
          <ToonMaterial color={metalLight} />
        </mesh>
      ))}
      <mesh position={[-0.25, 2.282, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.4, 12]} />
        <ToonMaterial color={metalLight} />
      </mesh>
      <mesh position={[-0.45, 2.245, 0]} scale={[1, 1, 0.78]} castShadow>
        <cylinderGeometry args={[0.211, 0.22, 0.045, 32]} />
        <ToonMaterial color={metal} />
        <Outlines thickness={0.0015} color={edge} screenspace={false} />
      </mesh>
      <mesh name="rain-spray-plate" position={[-0.45, 2.222, 0]} scale={[1, 1, 0.78]} castShadow>
        <cylinderGeometry args={[0.202, 0.19, 0.011, 32]} />
        <ToonMaterial color="#858986" />
      </mesh>
      <ShowerHose />
      <group position={[-0.17, 1.62, 0.1]} rotation={[0, 0, -0.24]}>
        <mesh name="contoured-handset" scale={[0.66, 1, 1]} castShadow receiveShadow>
          <latheGeometry args={[handset, 24]} />
          <ToonMaterial color={metalLight} />
        </mesh>
        <mesh
          name="hand-spray-face"
          position={[-0.044, 0.115, 0]}
          rotation={[0, 0, Math.PI / 2 + 0.08]}
          scale={[1.23, 1, 1]}
        >
          <cylinderGeometry args={[0.061, 0.065, 0.019, 24]} />
          <ToonMaterial color={metal} />
        </mesh>
      </group>
    </group>
  );
}
