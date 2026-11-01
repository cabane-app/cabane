import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../../furnishing/presets/construction/rounded-furniture-panel";
import { ApplianceSteam } from "./appliance-steam";
import { hasOperatingPower } from "./appliance-power";
import { StatusBeacon } from "../../visuals/device-visual-state";

/** Generic filter coffee maker with a glass carafe; front faces +Z. */
export function CoffeeMakerModel({ visualState, reducedMotion, readings }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  return (
    <group name="catalog-coffee-maker" userData={{ walkCollider: true }}>
      <RoundedFurniturePanel
        size={[0.24, 0.025, 0.34]}
        position={[0, 0.0125, 0]}
        color="#59635f"
        radius={0.006}
        outlineColor="#35413e"
      />
      <RoundedFurniturePanel
        size={[0.2, 0.31, 0.16]}
        position={[0, 0.18, -0.075]}
        color="#e3e1da"
        radius={0.018}
        outlineColor="#64706c"
      />
      <RoundedFurniturePanel
        size={[0.2, 0.025, 0.16]}
        position={[0, 0.3475, -0.075]}
        color="#c5ccc8"
        radius={0.008}
        outline={false}
      />
      <RoundedFurniturePanel
        name="coffee-maker-brew-head"
        size={[0.16, 0.05, 0.12]}
        position={[0, 0.274, 0.055]}
        color="#59635f"
        radius={0.008}
        outline={false}
      />
      <mesh name="coffee-maker-carafe" position={[0, 0.105, 0.075]} castShadow>
        <cylinderGeometry args={[0.063, 0.074, 0.15, 16]} />
        <ToonMaterial color="#9cb4b1" transparent opacity={0.68} />
        <Outlines color="#52605b" thickness={0.002} />
      </mesh>
      <mesh name="coffee-maker-carafe-handle" position={[0.075, 0.13, 0.075]}>
        <torusGeometry args={[0.035, 0.008, 6, 16, Math.PI * 1.75]} />
        <ToonMaterial color="#46514e" />
      </mesh>
      <RoundedFurniturePanel
        name="coffee-maker-display"
        size={[0.09, 0.035, 0.004]}
        position={[0, 0.218, 0.007]}
        color="#31413f"
        radius={0.002}
        outline={false}
      />
      <mesh position={[-0.067, 0.218, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.004, 12]} />
        <ToonMaterial
          color="#718078"
          emissive={active ? "#d96e4d" : "#718078"}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
      {active && hasOperatingPower(readings) && (
        <ApplianceSteam position={[0, 0.3, 0.08]} reducedMotion={reducedMotion} />
      )}
      <StatusBeacon visualState={visualState} position={[0.07, 0.218, 0.01]} scale={0.2} />
    </group>
  );
}
