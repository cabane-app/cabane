import { Vector2 } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

/** Closed metal section with a rounded lip and a genuinely open cooking cavity. */
export function PanBody({
  radius,
  height,
  baseRadius,
  color,
}: {
  radius: number;
  height: number;
  baseRadius: number;
  color: string;
}) {
  const profile = [
    [0, 0],
    [baseRadius - 0.004, 0],
    [baseRadius, 0.004],
    [radius - 0.002, height - 0.004],
    [radius, height - 0.002],
    [radius - 0.002, height],
    [radius - 0.005, height - 0.002],
    [baseRadius - 0.006, 0.012],
    [baseRadius - 0.01, 0.008],
    [0, 0.008],
  ].map(([r, y]) => new Vector2(r, y));
  return (
    <mesh name="open-pan-body" castShadow receiveShadow>
      <latheGeometry args={[profile, 32]} />
      <ToonMaterial color={color} />
      <Outlines color="#414644" thickness={0.0007} screenspace={false} />
    </mesh>
  );
}
