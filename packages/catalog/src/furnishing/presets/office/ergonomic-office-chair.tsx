import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { OfficeChairBase } from "./office-chair-base";

export const ERGONOMIC_OFFICE_CHAIR_SIZE = [0.68, 1.04, 0.68] as const;

export function ErgonomicOfficeChair({
  size = ERGONOMIC_OFFICE_CHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="ergonomic-office-chair"
      scale={[size[0] / 0.68, size[1] / 1.04, size[2] / 0.68]}
      userData={{ walkCollider: true }}
    >
      <OfficeChairBase />
      <RoundedFurniturePanel
        size={[0.43, 0.045, 0.43]}
        position={[0, 0.4375, 0.015]}
        color="#646b64"
        radius={0.02}
        outline={false}
      />
      <RoundedFurniturePanel
        name="office-chair-seat"
        size={[0.51, 0.085, 0.49]}
        position={[0, 0.5, 0.025]}
        color={color ?? "#ddd4c2"}
        radius={0.039}
      />
      <RoundedFurniturePanel
        size={[0.075, 0.27, 0.048]}
        position={[0, 0.59, -0.23]}
        rotation={[-0.12, 0, 0]}
        color="#61685f"
        radius={0.014}
        outline={false}
      />
      <RoundedFurniturePanel
        name="office-chair-back-shell"
        size={[0.465, 0.47, 0.057]}
        position={[0, 0.8033, -0.2813]}
        rotation={[-0.13, 0, 0]}
        color="#899086"
        radius={0.025}
      />
      <RoundedFurniturePanel
        name="office-chair-padded-back"
        size={[0.423, 0.428, 0.065]}
        position={[0, 0.8093, -0.2413]}
        rotation={[-0.13, 0, 0]}
        color={color ?? "#e0d8c8"}
        radius={0.03}
      />
      <RoundedFurniturePanel
        name="office-chair-lumbar-pad"
        size={[0.34, 0.09, 0.045]}
        position={[0, 0.6543, -0.1973]}
        color={color ?? "#c9c1ae"}
        radius={0.019}
        outline={false}
      />
      {[-0.3025, 0.3025].map((x) => (
        <group key={x}>
          <mesh
            name="office-chair-arm-bracket"
            position={[Math.sign(x) * 0.26, 0.458, 0.005]}
            castShadow
          >
            <boxGeometry args={[0.115, 0.035, 0.04]} />
            <ToonMaterial color="#787f75" />
          </mesh>
          <RoundedFurniturePanel
            size={[0.032, 0.21, 0.036]}
            position={[x, 0.56, 0.005]}
            color="#787f75"
            radius={0.01}
            outline={false}
          />
          <RoundedFurniturePanel
            name="office-chair-armrest"
            size={[0.075, 0.04, 0.265]}
            position={[x, 0.67, 0.035]}
            color="#555d54"
            radius={0.017}
          />
        </group>
      ))}
      <mesh
        name="office-chair-height-lever"
        position={[0.23, 0.423, -0.04]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
        <ToonMaterial color="#444b42" />
      </mesh>
    </group>
  );
}
