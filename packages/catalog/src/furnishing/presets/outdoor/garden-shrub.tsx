import { ToonMaterial, type SceneModelProps } from "@cabane/engine";
import { useMemo, useEffect } from "react";
import { DoubleSide } from "three";
import { createShrubSprays } from "./garden-shrub-sprays";

export const GARDEN_SHRUB_SIZE = [1.35, 0.92, 1.15] as const;

export function GardenShrub({ size }: SceneModelProps) {
  const geometry = useMemo(createShrubSprays, []);
  useEffect(
    () => () => {
      geometry.leaves.dispose();
      geometry.wood.dispose();
    },
    [geometry],
  );
  return (
    <group name="garden-shrub" scale={[size[0] / 1.35, size[1] / 0.92, size[2] / 1.15]}>
      <mesh geometry={geometry.wood} castShadow receiveShadow>
        <ToonMaterial color="#715c43" />
      </mesh>
      <mesh geometry={geometry.leaves} castShadow>
        <ToonMaterial vertexColors side={DoubleSide} />
      </mesh>
    </group>
  );
}
