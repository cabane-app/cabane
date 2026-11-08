import { Outlines, ToonMaterial } from "@cabane/engine";
import type { SceneModelProps } from "@cabane/engine";

import { TiedLinenPair } from "./tied-linen-pair";

/** One window's track and a single panel, gathered toward the selected side. */
export function SingleWindowCurtain({ size, variant, color }: SceneModelProps) {
  if (variant === "linen-tiebacks") {
    return (
      <group scale={[size[0] / 1.2, size[1] / 2.4, size[2] / 0.12]}>
        <TiedLinenPair color={color} />
      </group>
    );
  }
  const side = variant === "right" ? 1 : -1;
  return (
    <group name="single-window-curtain" scale={[size[0] / 1.2, size[1] / 2.4, size[2] / 0.12]}>
      <mesh position={[0, 2.36, 0.06]} castShadow>
        <boxGeometry args={[1.2, 0.08, 0.12]} />
        <ToonMaterial color="#dedbd3" />
        <Outlines color="#aaa399" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh position={[side * 0.37, 1.16, 0.075]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 2.32, 0.05]} />
        <ToonMaterial color={color ?? "#d8c8ad"} />
        <Outlines color="#a4957e" thickness={0.0015} screenspace={false} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((x) => (
        <mesh key={x} position={[side * 0.37 + x, 1.16, 0.102]} castShadow>
          <boxGeometry args={[0.018, 2.3, 0.012]} />
          <ToonMaterial color={color ?? "#c4b497"} />
        </mesh>
      ))}
    </group>
  );
}
