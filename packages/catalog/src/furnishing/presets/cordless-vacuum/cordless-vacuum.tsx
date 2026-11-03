import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction/rounded-furniture-panel";

export const CORDLESS_VACUUM_SIZE = [0.25, 1.256, 0.26] as const;

function VacuumCylinder({
  name,
  position,
  radius,
  height,
  color,
  rotation = [0, 0, 0],
  outline = false,
}: {
  name: string;
  position: [number, number, number];
  radius: number;
  height: number;
  color: string;
  rotation?: [number, number, number];
  outline?: boolean;
}) {
  return (
    <mesh name={name} position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 16]} />
      <ToonMaterial color={color} />
      {outline && <Outlines color="#48484f" thickness={0.0015} screenspace={false} />}
    </mesh>
  );
}

/** V8-inspired static docked vacuum; bottom Y=0 and wall-contact back Z=0. */
export function CordlessVacuum({ size = CORDLESS_VACUUM_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="cordless-vacuum"
      scale={
        size.map((value, axis) => value / CORDLESS_VACUUM_SIZE[axis]!) as [number, number, number]
      }
    >
      <RoundedFurniturePanel
        name="vacuum-wall-dock"
        size={[0.095, 0.25, 0.025]}
        position={[0, 1.065, 0.0125]}
        color="#696c73"
        outlineColor="#464950"
        radius={0.006}
      />
      <RoundedFurniturePanel
        name="vacuum-dock-cradle"
        size={[0.09, 0.04, 0.095]}
        position={[0, 0.96, 0.0625]}
        color="#62656c"
        outline={false}
      />
      <RoundedFurniturePanel
        name="vacuum-floor-head"
        size={[0.25, 0.065, 0.15]}
        position={[0, 0.0325, 0.185]}
        color="#575960"
        outlineColor="#3f4149"
        radius={0.012}
      />
      <VacuumCylinder
        name="vacuum-brush-roller"
        position={[0, 0.031, 0.235]}
        radius={0.024}
        height={0.21}
        rotation={[0, 0, Math.PI / 2]}
        color="#705b8b"
      />
      <RoundedFurniturePanel
        name="vacuum-head-neck"
        size={[0.05, 0.145, 0.075]}
        position={[0, 0.1175, 0.145]}
        color="#676970"
        outline={false}
        radius={0.012}
      />
      <VacuumCylinder
        name="vacuum-wand"
        position={[0, 0.532, 0.145]}
        radius={0.017}
        height={0.684}
        color="#b47537"
        outline
      />
      <VacuumCylinder
        name="vacuum-wand-coupler"
        position={[0, 0.875, 0.145]}
        radius={0.026}
        height={0.045}
        color="#686b70"
      />
      <RoundedFurniturePanel
        name="vacuum-release-button"
        size={[0.025, 0.025, 0.012]}
        position={[0, 0.88, 0.174]}
        color="#b94f4b"
        outline={false}
        radius={0.003}
      />
      <VacuumCylinder
        name="vacuum-dust-canister"
        position={[0, 0.995, 0.145]}
        radius={0.063}
        height={0.21}
        color="#a3afb1"
        outline
      />
      <VacuumCylinder
        name="vacuum-canister-bottom"
        position={[0, 0.896, 0.145]}
        radius={0.065}
        height={0.018}
        color="#72777c"
      />
      <VacuumCylinder
        name="vacuum-cyclone-crown"
        position={[0, 1.115, 0.145]}
        radius={0.075}
        height={0.045}
        color="#878b91"
        outline
      />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <VacuumCylinder
            key={index}
            name={`vacuum-cyclone-${index}`}
            position={[Math.cos(angle) * 0.049, 1.15, 0.145 + Math.sin(angle) * 0.049]}
            radius={0.021}
            height={0.065}
            color="#8f939a"
          />
        );
      })}
      <VacuumCylinder
        name="vacuum-upper-filter"
        position={[0, 1.216, 0.145]}
        radius={0.038}
        height={0.08}
        color="#76628b"
        outline
      />
      <RoundedFurniturePanel
        name="vacuum-handle-top"
        size={[0.045, 0.035, 0.105]}
        position={[0, 1.115, 0.079]}
        color="#5b5e65"
        outline={false}
        radius={0.008}
      />
      <RoundedFurniturePanel
        name="vacuum-hand-grip"
        size={[0.034, 0.14, 0.035]}
        position={[0, 1.045, 0.044]}
        color="#5b5e65"
        outline={false}
        radius={0.01}
      />
      <RoundedFurniturePanel
        name="vacuum-battery"
        size={[0.085, 0.045, 0.105]}
        position={[0, 0.965, 0.079]}
        color="#50535a"
        outlineColor="#3d4047"
        radius={0.008}
      />
    </group>
  );
}
