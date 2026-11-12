import { lazy } from "react";
import type { SceneFeatureDefinition } from "@cabane/engine";
import petIcon from "./assets/call-pet.png";

// Metadata stays cheap; neither Pet code nor its GLB loads until the shortcut is used.
export const installedSceneFeatures: readonly SceneFeatureDefinition[] = [
  {
    id: "pet",
    label: "Call pet",
    Icon: () => <img src={petIcon} alt="" draggable={false} />,
    Scene: lazy(() => import("@cabane/pet")),
  },
];
