import { lazy } from "react";
import type { SceneFeatureDefinition, SceneFeatureProps } from "@cabane/engine";
import type { PetModel } from "./model";
const PetScene = lazy(() => import("./PetScene"));
const defaultModel: PetModel = {
  url: new URL("../assets/companion.glb", import.meta.url).href,
  walkClip: "Walk_TailWag",
  idleClip: "Idle_TailWag",
  strideLength: 0.15 / 0.7,
  radius: 0.52,
  head: { bone: "head", forward: [0.6, -0.15, 0.8] },
};

export default function DefaultPetScene(props: SceneFeatureProps) {
  return <PetScene {...props} model={defaultModel} />;
}

/** Injected descriptors keep future model support outside the engine. */
export function createPetFeature(model: PetModel): SceneFeatureDefinition {
  return {
    id: "pet",
    label: "Call pet",
    Icon: () => null,
    Scene: (props) => <PetScene {...props} model={model} />,
  };
}
export type { PetModel } from "./model";
