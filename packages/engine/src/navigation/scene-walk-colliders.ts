import { Box3, Mesh, type Object3D } from "three";
import { importedWalkFootprint } from "../imported-models/walk-footprint";
import { WALK_EYE_HEIGHT, type BoxWalkCollider } from "./walk-navigation-contract";

type Observer = { queued: boolean; listeners: Set<() => void> };
const observers = new WeakMap<Object3D, Observer>();

export function observeSceneWalkColliders(scene: Object3D, listener: () => void) {
  let observer = observers.get(scene);
  if (!observer) observers.set(scene, (observer = { queued: false, listeners: new Set() }));
  observer.listeners.add(listener);
  return () => {
    observer.listeners.delete(listener);
  };
}

/** Coalesce model load/replacement notifications until React has attached its geometry. */
export function invalidateSceneWalkColliders(scene: Object3D) {
  const observer = observers.get(scene);
  if (!observer || observer.queued) return;
  observer.queued = true;
  queueMicrotask(() => {
    observer.queued = false;
    for (const listener of observer.listeners) listener();
  });
}

/** Movement and tool arrivals use the same loaded geometry and height filtering. */
export function collectSceneWalkColliders(
  scene: Object3D,
  elevation: number,
  headHeight = WALK_EYE_HEIGHT + 1,
): BoxWalkCollider[] {
  scene.updateMatrixWorld(true);
  const next: BoxWalkCollider[] = [];
  const bounds = new Box3();
  const groundClearance = elevation + 0.05 + 1e-7;
  scene.traverse((object) => {
    if (object.userData.walkCollider !== true) return;
    bounds.setFromObject(object);
    if (
      bounds.isEmpty() ||
      bounds.max.y <= groundClearance ||
      bounds.min.y >= elevation + headHeight ||
      ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
    )
      return;
    const envelope: BoxWalkCollider = {
      kind: "box",
      id: object.uuid,
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
      minY: bounds.min.y,
      maxY: bounds.max.y,
      ...(object.userData.walkSupport === true ? { supportY: bounds.max.y } : {}),
    };
    const meshes: Mesh[] = [];
    let imported = false;
    object.traverse((child) => {
      if (child instanceof Mesh && child.userData.importedModel === true) imported = true;
    });
    if (imported)
      object.traverseVisible((child) => {
        if (child instanceof Mesh && child.userData.importedModel === true)
          meshes.push(child as Mesh);
      });
    const colliders = imported
      ? (importedWalkFootprint(object, meshes, bounds) ?? [envelope])
      : [envelope];
    for (const collider of colliders)
      if (collider.maxY! > groundClearance && collider.minY! < elevation + headHeight)
        next.push(collider);
  });
  return next;
}
