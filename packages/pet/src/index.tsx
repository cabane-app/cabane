import { lazy } from "react";
import type { SceneFeatureDefinition } from "@cabane/engine";
import type { PetModel } from "./model";
const PetScene = lazy(() => import("./PetScene"));

/** The host supplies the asset; the engine knows neither this package nor a pet name. */
export function createPetFeature(model: PetModel): SceneFeatureDefinition {
  return {
    id: "pet",
    label: "Pet",
    Scene: (props) => <PetScene {...props} model={model} />,
  };
}
export type { PetModel } from "./model";
