import { omitUndefinedProperties } from "@cabane/engine";
import { RoundedBox } from "@cabane/engine";
import { Outlines, ToonMaterial } from "@cabane/engine";

/** A solid furniture panel or cushion with a small, real bevel. */
export function RoundedFurniturePanel({
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
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
  radius?: number;
  outline?: boolean;
  outlineColor?: string;
  name?: string;
  /** Stable model-local identity, independent of the display name and wrapper hierarchy. */
  glowKey?: string;
  creaseAngle?: number;
}) {
  return (
    <RoundedBox
      {...omitUndefinedProperties({ name: name })}
      {...(glowKey ? { userData: { modelGlowKey: glowKey } } : {})}
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
      <ToonMaterial color={color} />
      {outline && <Outlines color={outlineColor} thickness={0.0015} screenspace={false} />}
    </RoundedBox>
  );
}
