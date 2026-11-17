import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

import { wardrobeOakPull } from "./wardrobe-oak-pull";

export const FLAT_DOOR_WARDROBE_SIZE = [2, 2.2, 0.6] as const;

export function FlatDoorWardrobe({ size = FLAT_DOOR_WARDROBE_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="flat-door-wardrobe"
      scale={[size[0] / 2, size[1] / 2.2, size[2] / 0.6]}
      userData={{ walkCollider: true }}
    >
      <mesh position={[0, 0.054, -0.021]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.108, 0.498]} />
        <ToonMaterial color="#b49368" />
      </mesh>
      <RoundedFurniturePanel
        name="wardrobe-case"
        size={[1.963, 2.045, 0.528]}
        position={[0, 1.1285, -0.036]}
        color="#b49976"
        radius={0.008}
        outline={false}
      />
      {[-0.986, 0.986].map((x) => (
        <RoundedFurniturePanel
          key={x}
          name="wardrobe-oak-gable"
          size={[0.028, 2.069, 0.568]}
          position={[x, 1.1345, -0.015]}
          radius={0.006}
          color="#d4b586"
          outline={false}
        />
      ))}
      <RoundedFurniturePanel
        name="wardrobe-cornice"
        size={[2, 0.037, 0.579]}
        position={[0, 2.1815, -0.0095]}
        color="#daba8e"
        radius={0.009}
        outlineColor="#a88a66"
      />
      <RoundedFurniturePanel
        name="wardrobe-bottom-rail"
        size={[1.956, 0.039, 0.558]}
        position={[0, 0.121, -0.011]}
        color="#c3a175"
        radius={0.005}
        outline={false}
      />
      {[-0.732, -0.244, 0.244, 0.732].map((x, index) => (
        <group key={x}>
          <RoundedFurniturePanel
            name="wardrobe-edgebanded-leaf"
            size={[0.482, 2.002, 0.037]}
            position={[x, 1.145, 0.2425]}
            color="#cfb591"
            radius={0.005}
            outline={false}
          />
          <RoundedFurniturePanel
            name="wardrobe-flat-door"
            size={[0.474, 1.994, 0.012]}
            position={[x, 1.145, 0.259]}
            radius={0.005}
            color="#eeeade"
            outline={false}
          />
          <mesh
            name="wardrobe-oak-pull"
            position-x={x + (index % 2 === 0 ? 0.187 : -0.187)}
            geometry={wardrobeOakPull}
            dispose={null}
            castShadow
            receiveShadow
          >
            <ToonMaterial color="#bf9967" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
