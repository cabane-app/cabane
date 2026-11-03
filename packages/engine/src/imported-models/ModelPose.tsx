import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { AnimationClip, Object3D } from "three";
import { applyModelPose } from "./poses";

export function ModelPose({
  root,
  poses,
  pose,
}: {
  root: Object3D;
  poses: readonly AnimationClip[];
  pose: string | undefined;
}) {
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const reset = applyModelPose(root, poses, pose);
    invalidate();
    return () => {
      reset();
      invalidate();
    };
  }, [root, poses, pose, invalidate]);
  return null;
}
