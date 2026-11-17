import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { HouseplantPot } from "../decor/houseplant-pot";
import { terraceBlossoms } from "./terrace-blossoms";

export const FLOWER_POT_SIZE = [0.5, 0.8, 0.5] as const;
export function FlowerPot({
  size = FLOWER_POT_SIZE,
  variant = "lavender",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  const flower = variant === "white" ? "#f0ead9" : variant === "coral" ? "#c87a68" : "#a095bb";
  const geometry = useMemo(() => terraceBlossoms(flower), [flower]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group name="flower-pot" scale={[size[0] / 0.5, size[1] / 0.8, size[2] / 0.5]}>
      <HouseplantPot radius={0.25} height={0.36} color="#b67b5d" outline="#775340" />
      <mesh geometry={geometry} castShadow receiveShadow>
        <ToonMaterial vertexColors side={DoubleSide} />
      </mesh>
    </group>
  );
}
