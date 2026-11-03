import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import { ToonMaterial, Outlines } from "@cabane/engine";
import type { HomeDeviceModelProps, SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../furnishing/presets/construction/rounded-furniture-panel";
import { StatusBeacon } from "../visuals/device-visual-state";
import { IronShell } from "./iron-shell";

export const CLOTHES_IRON_SIZE: SceneItemSize = [0.12, 0.144, 0.32];

/** Generic iron resting flat, pointed nose at +Z, with a short trailing cord. */
export function ClothesIronModel({ visualState }: HomeDeviceModelProps) {
  const cord = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.075, -0.082),
        new Vector3(0, 0.074, -0.115),
        new Vector3(0.015, 0.042, -0.14),
        new Vector3(0.035, 0.012, -0.157),
      ]),
    [],
  );
  return (
    <group name="catalog-clothes-iron">
      <IronShell />
      {[-0.068, 0.067].map((z) => (
        <RoundedFurniturePanel
          key={z}
          name={`iron-handle-support-${z}`}
          size={[0.035, 0.07, 0.033]}
          position={[0, 0.087, z]}
          color="#e1e7e4"
          radius={0.009}
          outline={false}
        />
      ))}
      <RoundedFurniturePanel
        name="iron-open-grip"
        size={[0.038, 0.028, 0.169]}
        position={[0, 0.126, -0.0005]}
        color="#e1e7e4"
        radius={0.012}
        outlineColor="#82948f"
      />
      <RoundedFurniturePanel
        name="iron-grip-inlay"
        size={[0.023, 0.006, 0.094]}
        position={[0, 0.141, -0.009]}
        color="#4f6970"
        radius={0.0015}
        outline={false}
      />
      <mesh name="iron-temperature-dial" position={[0, 0.068, 0.005]}>
        <cylinderGeometry args={[0.024, 0.025, 0.018, 20]} />
        <ToonMaterial color="#e6e8df" />
        <Outlines color="#83918d" thickness={0.0008} screenspace={false} />
      </mesh>
      <mesh name="iron-dial-mark" position={[0, 0.078, 0.019]}>
        <boxGeometry args={[0.003, 0.002, 0.009]} />
        <ToonMaterial color="#536c70" />
      </mesh>
      <RoundedFurniturePanel
        name="iron-water-fill-cap"
        size={[0.026, 0.009, 0.025]}
        position={[0, 0.064, 0.097]}
        color="#e1e7e4"
        radius={0.004}
        outline={false}
      />
      <mesh name="iron-cord-collar" position={[0, 0.075, -0.088]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.007, 0.024, 10]} />
        <ToonMaterial color="#4f6970" />
      </mesh>
      <mesh name="iron-cord">
        <tubeGeometry args={[cord, 16, 0.003, 6, false]} />
        <ToonMaterial color="#59666a" />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.018, 0.072, 0.066]} scale={0.12} />
    </group>
  );
}
