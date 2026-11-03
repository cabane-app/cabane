import { ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps, SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../furnishing/presets/construction/rounded-furniture-panel";
import { StatusBeacon } from "../visuals/device-visual-state";

export const PAPER_PRINTER_SIZE: SceneItemSize = [0.44, 0.25, 0.42];

/** Generic desktop paper printer; tray faces +Z and the underside rests at Y=0. */
export function PaperPrinterModel({ visualState }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  return (
    <group name="catalog-paper-printer" userData={{ walkCollider: true }}>
      <RoundedFurniturePanel
        name="printer-base"
        size={[0.44, 0.06, 0.34]}
        position={[0, 0.03, -0.04]}
        color="#777f80"
        outlineColor="#4c5558"
        radius={0.009}
      />
      <RoundedFurniturePanel
        name="printer-rear-housing"
        size={[0.44, 0.14, 0.23]}
        position={[0, 0.125, -0.095]}
        color="#d9ddda"
        outlineColor="#737f80"
        radius={0.012}
      />
      {[-1, 1].map((side) => (
        <RoundedFurniturePanel
          key={side}
          name={`printer-side-${side}`}
          size={[0.047, 0.14, 0.14]}
          position={[side * 0.1965, 0.125, 0.06]}
          color="#d9ddda"
          outline={false}
          radius={0.007}
        />
      ))}
      <RoundedFurniturePanel
        name="printer-control-bridge"
        size={[0.44, 0.062, 0.14]}
        position={[0, 0.173, 0.06]}
        color="#d9ddda"
        outline={false}
        radius={0.009}
      />
      <RoundedFurniturePanel
        name="printer-scanner-lid"
        size={[0.426, 0.045, 0.326]}
        position={[0, 0.2275, -0.04]}
        color="#eceee9"
        outlineColor="#8b9492"
        radius={0.01}
      />
      <RoundedFurniturePanel
        name="printer-lid-seam"
        size={[0.408, 0.008, 0.304]}
        position={[0, 0.203, -0.04]}
        color="#6c7779"
        outline={false}
        radius={0.003}
      />
      <RoundedFurniturePanel
        name="printer-output-tray"
        size={[0.324, 0.012, 0.23]}
        position={[0, 0.058, 0.095]}
        color="#59656a"
        outlineColor="#3e4b51"
        radius={0.004}
      />
      <mesh name="printer-output-paper" position={[0, 0.0655, 0.09]} castShadow receiveShadow>
        <boxGeometry args={[0.21, 0.003, 0.218]} />
        <ToonMaterial color="#f7f5eb" />
      </mesh>
      {[0.13, 0.145, 0.16].map((z, index) => (
        <mesh key={z} position={[-0.015, 0.0675, z]}>
          <boxGeometry args={[index === 2 ? 0.085 : 0.135, 0.001, 0.002]} />
          <ToonMaterial color="#b9c1bf" />
        </mesh>
      ))}
      <RoundedFurniturePanel
        name="printer-control-panel"
        size={[0.15, 0.039, 0.007]}
        position={[-0.09, 0.174, 0.1315]}
        color="#536367"
        outline={false}
        radius={0.004}
      />
      <mesh name="printer-display" position={[-0.105, 0.174, 0.136]}>
        <boxGeometry args={[0.08, 0.023, 0.004]} />
        <ToonMaterial
          color={active ? "#a4c5bd" : "#405358"}
          emissive="#a4c5bd"
          emissiveIntensity={active ? 0.2 : 0}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[-0.035, 0.174, 0.138]} scale={0.22} />
      <RoundedFurniturePanel
        name="printer-paper-drawer-grip"
        size={[0.115, 0.009, 0.005]}
        position={[0, 0.027, 0.1315]}
        color="#48575c"
        outline={false}
        radius={0.002}
      />
    </group>
  );
}
