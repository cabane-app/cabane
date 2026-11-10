import { useEffect, useMemo } from "react";
import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import type { finish } from "./geometry";

export function TreeModel({
  size,
  nominal,
  create,
  bark,
  leaf,
  name,
}: {
  size: SceneItemSize;
  nominal: SceneItemSize;
  create: () => ReturnType<typeof finish>;
  bark: string;
  leaf: string;
  name: string;
}) {
  const geometry = useMemo(create, [create]);
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry]);
  return (
    <group name={name} scale={[size[0] / nominal[0], size[1] / nominal[1], size[2] / nominal[2]]}>
      <mesh geometry={geometry.wood} castShadow receiveShadow userData={{ walkCollider: true }}>
        <ToonMaterial color={bark} />
        <Outlines color="#514b40" thickness={0.0015} />
      </mesh>
      <mesh geometry={geometry.leaves} castShadow receiveShadow>
        <ToonMaterial color={leaf} />
      </mesh>
    </group>
  );
}
