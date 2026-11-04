import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const TRAVERTINE_COFFEE_TABLE_SIZE = [1.4, 0.36, 0.8] as const;
export function TravertineCoffeeTable({
  size = TRAVERTINE_COFFEE_TABLE_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="travertine-coffee-table"
      scale={[size[0] / 1.4, size[1] / 0.36, size[2] / 0.8]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        size={[1.4, 0.09, 0.8]}
        position={[0, 0.315, 0]}
        color="#d7c7a9"
        radius={0.04}
        outlineColor="#a99b81"
      />
      {[-0.39, 0.39].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            size={[0.24, 0.27, 0.55]}
            position={[x, 0.135, 0]}
            color="#c5b494"
            radius={0.025}
            outline={false}
          />
          {[-0.15, 0, 0.15].map((z) => (
            <mesh key={z} position={[x + 0.122, 0.13, z]}>
              <boxGeometry args={[0.003, 0.19, 0.008]} />
              <ToonMaterial color="#b7a485" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
