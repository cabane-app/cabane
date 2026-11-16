import { useEffect, useMemo } from "react";
import { Box3, DoubleSide, Matrix4, Vector3 } from "three";
import { Outlines, ToonMaterial, type SceneModelProps } from "@cabane/engine";
import { createDeciduousCrownGeometry } from "./deciduous-crown-geometry";
import { createDeciduousWoodGeometry } from "./deciduous-wood-geometry";

export const DECIDUOUS_TREE_SIZE = [2.4, 4.2, 2.4] as const;

export function DeciduousTree({ size }: SceneModelProps) {
  const geometry = useMemo(() => {
    const parts = { wood: createDeciduousWoodGeometry(), crown: createDeciduousCrownGeometry() };
    const bounds = new Box3();
    Object.values(parts).forEach((part) => {
      part.computeBoundingBox();
      bounds.union(part.boundingBox!);
    });
    const extent = bounds.getSize(new Vector3()),
      center = bounds.getCenter(new Vector3());
    const fit = new Matrix4()
      .makeScale(2.4 / extent.x, 4.2 / extent.y, 2.4 / extent.z)
      .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
    Object.values(parts).forEach((part) => part.applyMatrix4(fit));
    return parts;
  }, []);
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry]);

  return (
    <group name="deciduous-tree" scale={[size[0] / 2.4, size[1] / 4.2, size[2] / 2.4]}>
      <mesh
        name="deciduous-roots-trunk-and-boughs"
        geometry={geometry.wood}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#896547" />
        <Outlines color="#4c4030" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="deciduous-layered-crown" geometry={geometry.crown} castShadow>
        <ToonMaterial vertexColors side={DoubleSide} />
      </mesh>
    </group>
  );
}
