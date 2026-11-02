import { Box3, Matrix3, Mesh, Raycaster, Vector3, type Intersection, type Object3D } from "three";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import {
  WALK_MAX_STEP_METERS,
  WALK_PLAYER_RADIUS,
  type WalkPoint,
} from "./walk-navigation-contract";

/** Query existing terrain geometry, retaining its rounded edge and pool/stair cutouts. */
export function createTerrainHeightQuery(scene: Object3D, radius = WALK_PLAYER_RADIUS) {
  const ray = new Raycaster(),
    down = new Vector3(0, -1, 0),
    normalMatrix = new Matrix3(),
    bounds = new Box3();
  const hits: Intersection[] = [];
  return (point: WalkPoint): number | null => {
    const terrain = scene.getObjectByName("diorama-ground") as Mesh | undefined;
    if (!terrain?.isMesh) return null;
    terrain.updateWorldMatrix(true, false);
    normalMatrix.getNormalMatrix(terrain.matrixWorld);
    if (!terrain.geometry.boundingBox) terrain.geometry.computeBoundingBox();
    bounds.copy(terrain.geometry.boundingBox!).applyMatrix4(terrain.matrixWorld);
    let height: number | null = null;
    for (let i = -1; i < (radius === 0 ? 0 : 8); i++) {
      const angle = (i * Math.PI) / 4;
      const x = point.x + (i < 0 ? 0 : Math.cos(angle) * radius);
      const z = point.z + (i < 0 ? 0 : Math.sin(angle) * radius);
      ray.set(new Vector3(x, bounds.max.y + 0.1, z), down);
      ray.far = bounds.max.y - bounds.min.y + 0.2;
      hits.length = 0;
      // Support is geometry, independent of a non-selected storey's disabled
      // interaction raycasts. This does not enable picking or mutate the mesh.
      Mesh.prototype.raycast.call(terrain, ray, hits);
      const hit = hits.find(
        (hit) => (hit.face?.normal.clone().applyMatrix3(normalMatrix).normalize().y ?? 0) > 0.5,
      );
      if (!hit || (height !== null && Math.abs(hit.point.y - height) > WALK_MAX_STEP_METERS))
        return null;
      height ??= hit.point.y;
    }
    return height;
  };
}

/** Relocation keeps its existing conservative ground-level support contract. */
export function createTerrainSupportQuery(scene: Object3D) {
  const heightAt = createTerrainHeightQuery(scene);
  return (point: WalkPoint): boolean => {
    const height = heightAt(point);
    return height !== null && Math.abs(height - GROUND_ELEVATION_METERS) < 0.01;
  };
}
