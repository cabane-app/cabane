import { ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../../furnishing/presets/construction/rounded-furniture-panel";
import { StatusBeacon } from "../visuals/device-visual-state";
import { PrinterGantry } from "./printer-gantry";

export const PRINTER_3D_SIZE = [0.48, 0.6, 0.48] as const;

/** Generic open-frame printer, with a centered supporting-surface origin and +Z front. */
export function Printer3DModel({ visualState }: HomeDeviceModelProps) {
  return (
    <group name="catalog-printer-3d" userData={{ walkCollider: true }}>
      {[-0.19, 0.19].flatMap((x) =>
        [-0.17, 0.17].map((z) => (
          <Panel
            key={`${x}-${z}`}
            size={[0.06, 0.02, 0.06]}
            position={[x, 0.01, z]}
            color="#46504f"
            radius={0.004}
            outline={false}
          />
        )),
      )}
      <Panel
        name="printer-base"
        size={[0.48, 0.07, 0.46]}
        position={[0, 0.055, -0.01]}
        color="#d7dcd8"
        radius={0.012}
        outlineColor="#69736f"
      />
      {/* The two bed rails meet the base and support the build plate at Y=.12. */}
      {[-0.095, 0.095].map((x) => (
        <Panel
          key={x}
          size={[0.018, 0.03, 0.31]}
          position={[x, 0.105, 0]}
          color="#6b7976"
          radius={0.003}
          outline={false}
        />
      ))}
      <Panel
        name="printer-bed"
        size={[0.31, 0.014, 0.33]}
        position={[0, 0.127, 0]}
        color="#45524f"
        radius={0.004}
        outlineColor="#33413d"
      />
      <Panel
        name="printer-build-surface"
        size={[0.29, 0.004, 0.31]}
        position={[0, 0.136, 0]}
        color="#9aab9e"
        radius={0.002}
        outline={false}
      />
      <PrinterGantry />
      <Panel
        name="printer-display-bezel"
        size={[0.11, 0.043, 0.018]}
        position={[0.155, 0.058, 0.228]}
        color="#3c4947"
        radius={0.004}
        outline={false}
      />
      <Panel
        name="printer-display"
        size={[0.078, 0.026, 0.003]}
        position={[0.147, 0.058, 0.2385]}
        color={visualState === "connected-active" ? "#a9cfbf" : "#647a75"}
        radius={0.002}
        outline={false}
      />
      <StatusBeacon visualState={visualState} position={[0.19, 0.095, 0.17]} scale={0.2} />
      {[-0.16, -0.14, -0.12, -0.1].map((x) => (
        <mesh key={x} position={[x, 0.055, 0.221]}>
          <boxGeometry args={[0.008, 0.025, 0.002]} />
          <ToonMaterial color="#788781" />
        </mesh>
      ))}
    </group>
  );
}
