import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const WHEELIE_BIN_SIZE = [0.58, 1.05, 0.64] as const;

export function WheelieBin({
  size = WHEELIE_BIN_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="wheelie-bin"
      scale={[size[0] / 0.58, size[1] / 1.05, size[2] / 0.64]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        name="bin-body"
        size={[0.52, 0.9, 0.53]}
        position={[0, 0.52, 0.005]}
        color={color ?? "#6d8063"}
      />
      <RoundedFurniturePanel
        name="lid"
        size={[0.58, 0.06, 0.64]}
        position={[0, 1.02, 0]}
        color={color ?? "#414e49"}
      />
      <RoundedFurniturePanel
        name="rear-handle"
        size={[0.38, 0.04, 0.06]}
        position={[0, 0.93, -0.29]}
        color="#414e49"
      />
      <mesh
        name="wheel"
        position={[-0.26, 0.1, -0.2]}
        rotation={[0, 0, 1.5707963267948966]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
        <ToonMaterial color="#414e49" />
      </mesh>
      <mesh
        name="wheel"
        position={[0.26, 0.1, -0.2]}
        rotation={[0, 0, 1.5707963267948966]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
        <ToonMaterial color="#414e49" />
      </mesh>
      <RoundedFurniturePanel
        name="front-foot"
        size={[0.38, 0.07, 0.05]}
        position={[0, 0.035, 0.23]}
        color={color ?? "#6d8063"}
      />
    </group>
  );
}
