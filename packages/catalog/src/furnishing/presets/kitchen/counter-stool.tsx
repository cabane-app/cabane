import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

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
      {[-0.19, 0.19].flatMap((x) =>
        [-0.2, 0.2].map((z) => (
          <mesh key={`${x}-${z}`} name="counter-stool-leg" position={[x, 0.31, z]} castShadow>
            <boxGeometry args={[0.045, 0.62, 0.045]} />
            <ToonMaterial color="#b58b5b" />
          </mesh>
        )),
      )}
      {[
        [-0.19, 0, 0.4, 0.03],
        [0.19, 0, 0.4, 0.03],
        [0, -0.2, 0.38, 0.03],
        [0, 0.2, 0.38, 0.03],
      ].map((rail, i) =>
        i < 2 ? (
          <mesh key={i} name="counter-stool-footrail" position={[rail[0], rail[2], 0]}>
            <boxGeometry args={[0.025, 0.035, 0.4]} />
            <ToonMaterial color="#9b754e" />
          </mesh>
        ) : (
          <mesh key={i} name="counter-stool-footrail" position={[0, rail[2], rail[1]]}>
            <boxGeometry args={[0.38, 0.035, 0.025]} />
            <ToonMaterial color="#9b754e" />
          </mesh>
        ),
      )}
      <RoundedFurniturePanel
        name="counter-stool-seat"
        size={[0.48, 0.1, 0.5]}
        position={[0, 0.65, 0]}
        color={color ?? "#d9cbb4"}
        radius={0.045}
      />
      <RoundedFurniturePanel
        name="counter-stool-back"
        size={[0.48, 0.25, 0.07]}
        position={[0, 0.795, -0.215]}
        color="#d0ad78"
        radius={0.025}
      />
    </group>
  );
}
