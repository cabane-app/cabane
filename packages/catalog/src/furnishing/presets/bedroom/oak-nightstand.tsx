import { NightstandBase } from "./nightstand-base";
import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

import { NightstandDrawer } from "./nightstand-drawer";

export const OAK_NIGHTSTAND_SIZE = [0.45, 0.5, 0.4] as const;

export function OakNightstand({ size = OAK_NIGHTSTAND_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="oak-nightstand"
      scale={[size[0] / 0.45, size[1] / 0.5, size[2] / 0.4]}
      userData={{ walkCollider: true }}
    >
      <NightstandBase />
      <RoundedFurniturePanel
        name="nightstand-overhanging-cap"
        size={[0.45, 0.033, 0.4]}
        position={[0, 0.4835, 0]}
        color="#dbbc8d"
        radius={0.012}
        outlineColor="#aa8b62"
      />
      {[-0.204, 0.204].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.022, 0.367, 0.377]}
          position={[x, 0.285, -0.001]}
          color="#cfad7b"
          radius={0.006}
          outlineColor="#b79a72"
        />
      ))}
      <RoundedFurniturePanel
        size={[0.391, 0.029, 0.356]}
        position={[0, 0.117, -0.006]}
        color="#cba674"
        radius={0.006}
        outlineColor="#b79a72"
      />
      <RoundedFurniturePanel
        size={[0.391, 0.34, 0.018]}
        position={[0, 0.298, -0.174]}
        color="#b69262"
        radius={0.003}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.391, 0.024, 0.353]}
        position={[0, 0.291, -0.012]}
        color="#c7a16e"
        radius={0.003}
      />
      <NightstandDrawer />
    </group>
  );
}
