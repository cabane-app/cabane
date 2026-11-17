import { useEffect, useMemo } from "react";
import { Box3, DoubleSide, Matrix4, Vector3 } from "three";
import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { createOliveCrownGeometry } from "./olive-crown-geometry";
import { createOliveWoodGeometry } from "./olive-wood-geometry";

export const OLIVE_TREE_SIZE = [3.8, 3.6, 3.2] as const;

export function OliveTree({ size = OLIVE_TREE_SIZE }: { size?: SceneItemSize }) {
  const geometry = useMemo(() => {
    const parts = { ...createOliveWoodGeometry(), ...createOliveCrownGeometry() };
    const bounds = new Box3();
    for (const part of Object.values(parts)) {
      part.computeBoundingBox();
      bounds.union(part.boundingBox!);
    }
    const extent = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    // Fit the complete authored tree together, preserving all branch/leaf contacts.
    const fit = new Matrix4()
      .makeScale(3.8 / extent.x, 3.6 / extent.y, 3.2 / extent.z)
      .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
    Object.values(parts).forEach((part) => part.applyMatrix4(fit));
    return parts;
  }, []);
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry]);

  return (
    <group name="olive-tree" scale={[size[0] / 3.8, size[1] / 3.6, size[2] / 3.2]}>
      <mesh
        name="olive-root-flare-and-twisted-trunk"
        geometry={geometry.trunk}
        castShadow
        receiveShadow
        userData={{ walkCollider: true }}
      >
        <ToonMaterial vertexColors />
        <Outlines color="#514a3d" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="olive-sculpted-boughs" geometry={geometry.boughs} castShadow receiveShadow>
        <ToonMaterial vertexColors />
        <Outlines color="#514a3d" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="olive-rounded-leaf-sprays" geometry={geometry.leaves} castShadow receiveShadow>
        <ToonMaterial vertexColors side={DoubleSide} />
      </mesh>
      <mesh name="olive-fruit" geometry={geometry.olives} castShadow>
        <ToonMaterial vertexColors />
      </mesh>
    </group>
  );
}
