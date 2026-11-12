import { Quaternion, Vector3, type Object3D } from "three";
import type { PetModel } from "./model";

/** Calibrate from the asset's bind pose, then aim in the actor's travel direction. */
export function createLookAhead(root: Object3D, calibration: PetModel["head"]) {
  const head = calibration && root.getObjectByName(calibration.bone);
  if (!head || !calibration) return null;
  root.updateMatrixWorld(true);
  const localForward = new Vector3(...calibration.forward)
    .normalize()
    .applyQuaternion(head.getWorldQuaternion(new Quaternion()).invert());
  const base = head.quaternion.clone();
  const current = new Quaternion(),
    parent = new Quaternion(),
    actor = new Quaternion();
  const direction = new Vector3(),
    desired = new Vector3();
  let applied = false;
  return {
    restore() {
      if (applied) head.quaternion.copy(base);
      applied = false;
    },
    update(actorRoot: Object3D) {
      base.copy(head.quaternion);
      actorRoot.updateMatrixWorld(true);
      head.getWorldQuaternion(current);
      direction.copy(localForward).applyQuaternion(current).normalize();
      desired.set(0, 0, 1).applyQuaternion(actorRoot.getWorldQuaternion(actor));
      current.premultiply(new Quaternion().setFromUnitVectors(direction, desired));
      head.parent!.getWorldQuaternion(parent).invert();
      head.quaternion.copy(parent.multiply(current));
      head.updateMatrixWorld(true);
      applied = true;
    },
  };
}
