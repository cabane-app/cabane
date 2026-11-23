import { omitUndefinedProperties, Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";
import { useCallback } from "react";
import type { Mesh } from "three";
import { OakVeneerMaterial, projectOakGrain, type GrainAxis } from "./oak-veneer";

/** A solid furniture panel or cushion with a small, real bevel. */
export function RoundedFurniturePanel({
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  grain,
  grainOffset = position[0] + position[1] + position[2],
  radius = 0.006,
  outline = true,
  outlineColor = "#716657",
  name,
  glowKey,
  creaseAngle = 0.4,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  grain?: GrainAxis | undefined;
  grainOffset?: number;
  radius?: number;
  outline?: boolean;
  outlineColor?: string;
  name?: string;
  /** Stable model-local identity, independent of the display name and wrapper hierarchy. */
  glowKey?: string;
  creaseAngle?: number;
}) {
  const mapGrain = useCallback(
    (mesh: Mesh) => {
      if (grain) projectOakGrain(mesh.geometry, grain, grainOffset);
    },
    [grain, grainOffset],
  );
  return (
    <RoundedBox
      {...omitUndefinedProperties({ name: name })}
      {...(glowKey ? { userData: { modelGlowKey: glowKey } } : {})}
      {...(grain && { onUpdate: mapGrain })}
      args={size}
      position={position}
      rotation={rotation}
      radius={Math.min(radius, ...size.map((dimension) => dimension / 2 - 0.0001))}
      smoothness={2}
      bevelSegments={2}
      creaseAngle={creaseAngle}
      castShadow
      receiveShadow
    >
      {grain ? <OakVeneerMaterial color={color} /> : <ToonMaterial color={color} />}
      {outline && <Outlines color={outlineColor} thickness={0.0015} screenspace={false} />}
    </RoundedBox>
  );
}
