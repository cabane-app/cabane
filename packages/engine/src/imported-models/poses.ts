import { AnimationMixer, type AnimationClip, type Object3D } from "three";
import type { CustomModelPoses, CustomModelProfile } from "./contracts";
import type { EntityStateSnapshot } from "../types";

export function modelPoseStates(profile: CustomModelProfile): readonly string[] {
  if (["switch", "input_boolean", "binary_sensor", "light"].includes(profile)) return ["off", "on"];
  if (profile === "cover") return ["closed", "open", "opening", "closing"];
  if (profile === "lock") return ["locked", "unlocked"];
  return [];
}

export function selectedModelPose(mapping?: CustomModelPoses, state?: EntityStateSnapshot) {
  return (
    (state?.available && !state.stale && mapping && Object.hasOwn(mapping.states, state.state)
      ? mapping.states[state.state]
      : undefined) ?? mapping?.defaultPose
  );
}

/** Applying a pose owns only this instance's transforms. Cleanup restores the rest pose. */
export function applyModelPose(root: Object3D, clips: readonly AnimationClip[], id?: string) {
  const clip = id === undefined ? undefined : clips[Number(id)];
  if (!clip) return () => {};
  const mixer = new AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  return () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    root.updateMatrixWorld(true);
  };
}
