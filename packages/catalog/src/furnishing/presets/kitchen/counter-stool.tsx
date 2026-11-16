import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

import { stoolBentBack, stoolFootrails, stoolFrame } from "./counter-stool-frame";

export const COUNTER_STOOL_SIZE = [0.48, 0.92, 0.5] as const;

/** Oak counter stool with a 65 cm padded seat, low back, and foot rail. */
export function CounterStool({
  size = COUNTER_STOOL_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="counter-stool"
      scale={[size[0] / 0.48, size[1] / 0.92, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      <mesh name="counter-stool-leg" geometry={stoolFrame} dispose={null} castShadow receiveShadow>
        <ToonMaterial color="#b58b5b" />
      </mesh>
      <mesh
        name="counter-stool-footrail"
        geometry={stoolFootrails}
        dispose={null}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#9b754e" />
      </mesh>
      <RoundedFurniturePanel
        name="counter-stool-seat-pan"
        size={[0.46, 0.042, 0.45]}
        position={[0, 0.604, 0.006]}
        color="#c7a271"
        radius={0.02}
        outline={false}
      />
      <RoundedFurniturePanel
        name="counter-stool-seat"
        size={[0.48, 0.075, 0.47]}
        position={[0, 0.6525, 0.015]}
        color={color ?? "#d9cbb4"}
        radius={0.035}
        outlineColor="#a2947d"
      />
      <mesh
        name="counter-stool-back"
        geometry={stoolBentBack}
        position-y={0.916}
        dispose={null}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#d0ad78" />
        <Outlines color="#95784f" thickness={0.0015} screenspace={false} />
      </mesh>
    </group>
  );
}
