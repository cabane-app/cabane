import { OakVeneerMaterial } from "../construction/oak-veneer";
import { type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";
import { RoundedFurniturePanel } from "../construction";

export const RECTANGULAR_COFFEE_TABLE_SIZE = [1.1, 0.4, 0.6] as const;
const leg = [
  [0, 0],
  [0.018, 0],
  [0.021, 0.005],
  [0.029, 0.142],
  [0.035, 0.274],
  [0.037, 0.348],
  [0, 0.348],
].map(([r, y]) => new Vector2(r, y));
export function RectangularCoffeeTable({
  size = RECTANGULAR_COFFEE_TABLE_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="rectangular-coffee-table"
      scale={[size[0] / 1.1, size[1] / 0.4, size[2] / 0.6]}
      userData={{ walkCollider: true, walkSupport: true }}
    >
      <RoundedFurniturePanel
        grain="x"
        name="coffee-table-top"
        size={[1.1, 0.045, 0.6]}
        position={[0, 0.3775, 0]}
        radius={0.021}
        color="#d7b783"
        outlineColor="#9e7f53"
      />
      <RoundedFurniturePanel
        grain="x"
        name="undercut-top-edge"
        size={[1.05, 0.026, 0.55]}
        position={[0, 0.349, 0]}
        radius={0.012}
        color="#c9a370"
        outline={false}
      />
      {[-0.462, 0.462].map((x) => (
        <group key={x}>
          {[-0.215, 0.215].map((z) => (
            <mesh key={z} name="coffee-table-leg" position={[x, 0, z]} castShadow receiveShadow>
              <latheGeometry args={[leg, 12]} />
              <OakVeneerMaterial color="#b98f5e" />
            </mesh>
          ))}
          <RoundedFurniturePanel
            grain="z"
            name="shelf-bearer"
            size={[0.047, 0.036, 0.446]}
            position={[x, 0.128, 0]}
            radius={0.009}
            color="#b98f5e"
            outline={false}
          />
        </group>
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <RoundedFurniturePanel
          grain="x"
          key={i}
          name="coffee-table-lower-rail"
          size={[0.949, 0.022, 0.06]}
          position={[0, 0.153, i * 0.079]}
          radius={0.009}
          color={i % 2 ? "#c9a370" : "#cfab77"}
          outline={false}
        />
      ))}
    </group>
  );
}
