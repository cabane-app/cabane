import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Group, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { conformToTerrain } from "../terrain/terrain-geometry";
import type { TerrainSurface } from "../terrain/terrain-surface";

/** Conform structural solids along the grade without multiplying boundary models.
 * Individual instanced plants retain their geometry and follow their own roots. */
export function TerrainHedge({
  terrain,
  children,
}: {
  terrain: NonNullable<TerrainSurface>;
  children: ReactNode;
}) {
  const root = useRef<Group>(null);
  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const restore: (() => void)[] = [];
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      if ((mesh as InstancedMesh).isInstancedMesh) {
        const instances = mesh as InstancedMesh;
        const original = instances.instanceMatrix.array.slice();
        const matrix = new Matrix4();
        for (let i = 0; i < instances.count; i++) {
          instances.getMatrixAt(i, matrix);
          const point = new Vector3().setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
          matrix.elements[13] += terrain.offsetAt(point.x, point.z);
          instances.setMatrixAt(i, matrix);
        }
        instances.instanceMatrix.needsUpdate = true;
        instances.computeBoundingBox();
        instances.computeBoundingSphere();
        restore.push(() => {
          instances.instanceMatrix.array.set(original);
          instances.instanceMatrix.needsUpdate = true;
          instances.computeBoundingBox();
          instances.computeBoundingSphere();
        });
      } else {
        const original = mesh.geometry;
        // Terrain geometry uses XY as world X/-Z and displaces its local Z.
        const transform = new Matrix4().makeRotationX(Math.PI / 2).multiply(mesh.matrixWorld);
        const conformed = conformToTerrain(original.clone().applyMatrix4(transform), terrain);
        conformed.applyMatrix4(transform.invert());
        conformed.computeBoundingBox();
        conformed.computeBoundingSphere();
        mesh.geometry = conformed;
        restore.push(() => {
          if (mesh.geometry === conformed) mesh.geometry = original;
          conformed.dispose();
        });
      }
    });
    return () => restore.forEach((reset) => reset());
  }, [terrain, children]);
  return <group ref={root}>{children}</group>;
}
