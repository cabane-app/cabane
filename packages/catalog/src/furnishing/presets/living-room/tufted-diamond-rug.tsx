import { useMemo } from "react";
import { Shape, Path } from "three";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

export const TUFTED_DIAMOND_RUG_SIZE = [2.6, 0.016, 2] as const;
const diamondExtrusion = { depth: 0.004, bevelEnabled: false };

export function TuftedDiamondRug({
  size = TUFTED_DIAMOND_RUG_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
}) {
  const diamond = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0.3);
    shape.lineTo(0.22, 0);
    shape.lineTo(0, -0.3);
    shape.lineTo(-0.22, 0);
    shape.closePath();
    const hole = new Path();
    hole.moveTo(0, 0.24);
    hole.lineTo(-0.17, 0);
    hole.lineTo(0, -0.24);
    hole.lineTo(0.17, 0);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  }, []);
  return (
    <group name="tufted-diamond-rug" scale={[size[0] / 2.6, size[1] / 0.016, size[2] / 2]}>
      <RoundedFurniturePanel
        size={[2.4, 0.012, 2]}
        position={[0, 0.006, 0]}
        color={color ?? "#ddd7c8"}
        radius={0.004}
        outline={false}
      />
      {[-0.72, 0, 0.72].flatMap((x) =>
        [-0.52, 0.52].map((z) => (
          <mesh
            name="raised-rug-diamond"
            key={`${x}-${z}`}
            position={[x, 0.012, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <extrudeGeometry args={[diamond, diamondExtrusion]} />
            <ToonMaterial color="#c9c2b0" />
          </mesh>
        )),
      )}
      {[-1.25, 1.25].flatMap((x) =>
        Array.from({ length: 25 }, (_, i) => (
          <mesh
            key={`${x}-${i}`}
            position={[x, 0.003, -0.96 + i * 0.08]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.003, 0.003, 0.1, 6]} />
            <ToonMaterial color="#e9e3d6" />
          </mesh>
        )),
      )}
    </group>
  );
}
