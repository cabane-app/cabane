import { MathUtils, Quaternion, Vector3, type Object3D } from "three";
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
  let yaw = 0,
    pitch = 0;
  const localTarget = new Vector3();
  return {
    restore() {
      if (applied) head.quaternion.copy(base);
      applied = false;
    },
    update(actorRoot: Object3D, target?: Vector3, dt = 0.05) {
      base.copy(head.quaternion);
      actorRoot.updateMatrixWorld(true);
      head.getWorldQuaternion(current);
      direction.copy(localForward).applyQuaternion(current).normalize();
      let targetYaw = 0,
        targetPitch = 0;
      if (target) {
        localTarget
          .copy(target)
          .sub(head.getWorldPosition(desired))
          .applyQuaternion(actorRoot.getWorldQuaternion(actor).invert());
        targetYaw = MathUtils.clamp(Math.atan2(localTarget.x, localTarget.z), -1.1, 1.1);
        targetPitch = MathUtils.clamp(
          Math.atan2(localTarget.y, Math.hypot(localTarget.x, localTarget.z)),
          -0.3,
          0.5,
        );
      }
      const blend = 1 - Math.exp(-7 * dt);
      yaw = MathUtils.lerp(yaw, targetYaw, blend);
      pitch = MathUtils.lerp(pitch, targetPitch, blend);
      desired
        .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
        .applyQuaternion(actorRoot.getWorldQuaternion(actor));
      current.premultiply(new Quaternion().setFromUnitVectors(direction, desired));
      head.parent!.getWorldQuaternion(parent).invert();
      head.quaternion.copy(parent.multiply(current));
      head.updateMatrixWorld(true);
      applied = true;
    },
  };
}
