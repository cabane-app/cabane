import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const CINEMA_RECLINER_SIZE = [0.96, 1.08, 1.08] as const;
export function CinemaRecliner({
  size = CINEMA_RECLINER_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  return (
    <group
      name="cinema-recliner"
      scale={[size[0] / 0.96, size[1] / 1.08, size[2] / 1.08]}
      userData={{ walkCollider: true }}
    >
      <RoundedFurniturePanel
        size={[0.82, 0.2, 0.88]}
        position={[0, 0.18, 0]}
        color="#332e2b"
        radius={0.035}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.64, 0.2, 0.76]}
        position={[0, 0.38, 0.12]}
        color={color ?? "#66564a"}
        radius={0.065}
      />
      <RoundedFurniturePanel
        size={[0.66, 0.64, 0.23]}
        position={[0, 0.76, -0.425]}
        color={color ?? "#66564a"}
        radius={0.08}
      />
      <RoundedFurniturePanel
        size={[0.48, 0.18, 0.045]}
        position={[0, 0.91, -0.29]}
        color={color ?? "#756353"}
        radius={0.04}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[0.62, 0.26, 0.12]}
        position={[0, 0.24, 0.48]}
        color={color ?? "#66564a"}
        radius={0.025}
      />
      {[-0.395, 0.395].map((x) => (
        <group key={x}>
          <RoundedFurniturePanel
            size={[0.17, 0.39, 0.95]}
            position={[x, 0.405, 0.015]}
            color={color ?? "#66564a"}
            radius={0.04}
          />
          <mesh position={[x, 0.602, 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.031, 0.042, 20]} />
            <ToonMaterial color="#ac9466" />
          </mesh>
          <mesh position={[x, 0.601, 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.031, 20]} />
            <ToonMaterial color="#282725" />
          </mesh>
        </group>
      ))}
      {[-0.32, 0.32].flatMap((x) =>
        [-0.35, 0.35].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.04, z]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
            <ToonMaterial color="#37322e" />
          </mesh>
        )),
      )}
    </group>
  );
}
