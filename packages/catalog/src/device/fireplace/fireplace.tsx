import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps, SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../furnishing/presets/construction/rounded-furniture-panel";
import { FireplaceFire } from "./fireplace-fire";

export const FIREPLACE_SIZE: SceneItemSize = [1.4, 1.2, 0.5];

/** Traditional floor-standing stone surround, with its back against Z=0. */
export function FireplaceModel({ visualState, reducedMotion }: HomeDeviceModelProps) {
  return (
    <group name="catalog-fireplace" userData={{ walkCollider: true }}>
      <RoundedFurniturePanel
        name="fireplace-hearth"
        size={[1.4, 0.08, 0.5]}
        position={[0, 0.04, 0.25]}
        color="#8e8980"
        outlineColor="#635e56"
      />
      <mesh name="fireplace-firebox-back" position={[0, 0.525, 0.025]} receiveShadow>
        <boxGeometry args={[0.8, 0.89, 0.05]} />
        <ToonMaterial color="#49413b" />
      </mesh>
      <mesh name="fireplace-firebox-floor" position={[0, 0.09, 0.19]} receiveShadow>
        <boxGeometry args={[0.8, 0.02, 0.28]} />
        <ToonMaterial color="#49413b" />
      </mesh>
      {[-1, 1].map((side) => (
        <RoundedFurniturePanel
          key={side}
          name={`fireplace-jamb-${side}`}
          size={[0.24, 1.03, 0.3]}
          position={[side * 0.52, 0.585, 0.15]}
          color="#d8cebb"
          outlineColor="#9d917d"
          radius={0.009}
        />
      ))}
      <RoundedFurniturePanel
        name="fireplace-lintel"
        size={[1.04, 0.16, 0.308]}
        position={[0, 1.025, 0.154]}
        color="#d8cebb"
        outlineColor="#9d917d"
        radius={0.008}
      />
      <RoundedFurniturePanel
        name="fireplace-mantel"
        size={[1.4, 0.1, 0.38]}
        position={[0, 1.15, 0.19]}
        color="#e8dfcd"
        outlineColor="#9d917d"
        radius={0.009}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          name={`fireplace-log-${side}`}
          position={[0, 0.155, 0.19 + side * 0.055]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.055, 0.055, 0.58, 8]} />
          <ToonMaterial color={side === 1 ? "#74533a" : "#5f4432"} />
          <Outlines color="#493526" thickness={0.0015} screenspace={false} />
        </mesh>
      ))}
      {visualState === "connected-active" && <FireplaceFire reducedMotion={reducedMotion} />}
    </group>
  );
}
