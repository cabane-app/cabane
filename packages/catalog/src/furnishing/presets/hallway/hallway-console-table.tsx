import { OakVeneerMaterial } from "../construction/oak-veneer";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
import { RoundedFurniturePanel as Panel } from "../construction";
export const HALLWAY_CONSOLE_TABLE_SIZE = [1.1, 0.8, 0.35] as const;
const spindle = [
  [0, 0],
  [0.019, 0],
  [0.023, 0.015],
  [0.02, 0.038],
  [0.016, 0.052],
  [0.023, 0.09],
  [0.029, 0.47],
  [0.037, 0.52],
  [0.024, 0.55],
  [0.024, 0.565],
  [0.035, 0.574],
  [0.035, 0.63],
  [0, 0.63],
].map(([r, y]) => new Vector2(r, y));
/** Turned legs carry the drawer apron. A low H-stretcher braces the slender frame. */
export function HallwayConsoleTable({
  size = HALLWAY_CONSOLE_TABLE_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="hallway-console-table"
      scale={[size[0] / 1.1, size[1] / 0.8, size[2] / 0.35]}
      userData={{ walkCollider: true }}
    >
      {[-0.46, 0.46].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.12, 0.12].map((z) => (
            <mesh key={z} position={[0, 0, z]} castShadow>
              <latheGeometry args={[spindle, 12]} />
              <OakVeneerMaterial color="#b58b59" />
            </mesh>
          ))}
          <Panel
            grain="z"
            size={[0.027, 0.034, 0.24]}
            position={[0, 0.11, 0]}
            color="#b68c5c"
            outline={false}
          />
        </group>
      ))}
      <Panel
        grain="x"
        size={[0.916, 0.028, 0.024]}
        position={[0, 0.11, 0]}
        color="#bd9767"
        outline={false}
      />
      <Panel
        grain="x"
        size={[1.004, 0.15, 0.288]}
        position={[0, 0.68, -0.007]}
        color="#bb9567"
        outline={false}
      />
      <Panel
        grain="x"
        size={[1.05, 0.018, 0.326]}
        position={[0, 0.752, 0]}
        color="#bf9968"
        outline={false}
      />
      <Panel
        grain="x"
        size={[1.1, 0.045, 0.35]}
        position={[0, 0.7775, 0]}
        color="#d5b27d"
        radius={0.009}
        outlineColor="#a48463"
      />
      {[-0.243, 0.243].map((x) => (
        <group key={x} position={[x, 0.682, 0]}>
          <Panel
            grain="x"
            name="console-drawer"
            grainOffset={x}
            size={[0.477, 0.117, 0.026]}
            position={[0, 0, 0.144]}
            color="#ddc092"
            radius={0.007}
            outline={false}
          />
          <mesh position={[0, 0, 0.158]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.021, 0.005, 16]} />
            <ToonMaterial color="#94846e" />
          </mesh>
          <mesh name="console-drawer-knob" position={[0, 0, 0.166]} scale={[1, 1, 0.6]}>
            <sphereGeometry args={[0.015, 12, 8]} />
            <ToonMaterial color="#7e7568" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
