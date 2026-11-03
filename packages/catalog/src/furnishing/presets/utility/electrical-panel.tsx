import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

export const ELECTRICAL_PANEL_SIZE = [0.2, 0.32, 0.1] as const;

/** Generic lime-green electricity meter; bottom Y=0, wall-contact back Z=0. */
export function ElectricalPanel({ size = ELECTRICAL_PANEL_SIZE }: { size?: SceneItemSize } = {}) {
  return (
    <group name="electrical-panel" scale={[size[0] / 0.2, size[1] / 0.32, size[2] / 0.1]}>
      <RoundedFurniturePanel
        name="meter-back-shell"
        size={[0.2, 0.32, 0.07]}
        position={[0, 0.16, 0.035]}
        radius={0.012}
        color="#b4cc35"
        outlineColor="#74852b"
      />
      <RoundedFurniturePanel
        name="meter-upper-cover"
        size={[0.188, 0.217, 0.05]}
        position={[0, 0.2055, 0.065]}
        radius={0.009}
        color="#c3db43"
        outline={false}
      />
      <RoundedFurniturePanel
        name="meter-terminal-cover"
        size={[0.188, 0.09, 0.05]}
        position={[0, 0.051, 0.075]}
        radius={0.007}
        color="#a9c32c"
        outline={false}
      />
      <RoundedFurniturePanel
        name="meter-display-bezel"
        size={[0.126, 0.061, 0.012]}
        position={[0, 0.245, 0.088]}
        radius={0.004}
        color="#74805a"
        outline={false}
      />
      <mesh name="meter-lcd" position={[0, 0.245, 0.0945]}>
        <boxGeometry args={[0.111, 0.045, 0.005]} />
        <ToonMaterial color="#b5bba3" />
      </mesh>
      {[-1, 1].map((side) => (
        <RoundedFurniturePanel
          key={side}
          name={`meter-button-${side}`}
          size={[0.033, 0.026, 0.016]}
          position={[side * 0.033, 0.178, 0.089]}
          radius={0.005}
          color="#d4e763"
          outline={false}
        />
      ))}
      <mesh name="meter-button-minus" position={[-0.033, 0.178, 0.097]}>
        <boxGeometry args={[0.012, 0.002, 0.006]} />
        <ToonMaterial color="#687834" />
      </mesh>
      <mesh name="meter-button-plus-horizontal" position={[0.033, 0.178, 0.097]}>
        <boxGeometry args={[0.012, 0.002, 0.006]} />
        <ToonMaterial color="#687834" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          name={`meter-button-plus-tip-${side}`}
          position={[0.033, 0.178 + side * 0.0035, 0.097]}
        >
          <boxGeometry args={[0.002, 0.005, 0.006]} />
          <ToonMaterial color="#687834" />
        </mesh>
      ))}
      <mesh name="meter-identification-strip" position={[0, 0.128, 0.09]}>
        <boxGeometry args={[0.084, 0.017, 0.006]} />
        <ToonMaterial color="#e0e4c7" />
      </mesh>
      <mesh name="meter-status-lens" position={[0, 0.294, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.006, 12]} />
        <ToonMaterial color="#5c663c" />
      </mesh>
    </group>
  );
}
