import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { CurvedChairBack } from "./curved-chair-back";

export const OAK_DINING_CHAIR_SIZE = [0.49, 0.82, 0.5] as const;

export function OakDiningChair({
  size = OAK_DINING_CHAIR_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="oak-dining-chair"
      scale={[size[0] / 0.49, size[1] / 0.82, size[2] / 0.5]}
      userData={{ walkCollider: true }}
    >
      {[-0.18, 0.18].flatMap((x) =>
        [-0.165, 0.17].map((z) => (
          <mesh key={`${x}-${z}`} name="dining-chair-leg" position={[x, 0.21, z]} castShadow>
            <cylinderGeometry args={[0.022, 0.016, 0.42, 10]} />
            <ToonMaterial color="#c7a16d" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.46, 0.045, 0.47]}
        position={[0, 0.4175, 0.015]}
        color="#c8a572"
        radius={0.018}
      />
      <RoundedFurniturePanel
        name="dining-chair-upholstered-seat"
        size={[0.445, 0.045, 0.435]}
        position={[0, 0.4625, 0.0225]}
        color={color ?? "#e3d7c2"}
        radius={0.019}
      />
      {[-0.185, 0.185].map((x) => (
        <mesh key={x} position={[x, 0.5725, -0.19]} castShadow>
          <cylinderGeometry args={[0.018, 0.023, 0.31, 10]} />
          <ToonMaterial color="#c9a674" />
        </mesh>
      ))}
      <CurvedChairBack />
    </group>
  );
}
