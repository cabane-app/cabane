import { createPetFeature } from "@cabane/pet";

// Host-owned asset configuration. Personal models never enter engine/catalog/home.
const modelUrl = import.meta.env.VITE_PET_MODEL_URL as string | undefined;
export const installedSceneFeatures = modelUrl
  ? [
      createPetFeature({
        url: modelUrl,
        walkClip: "Walk_TailWag",
        idleClip: "Idle_TailWag",
        strideLength: 0.15 / 0.7,
        radius: 0.52,
        head: { bone: "head", forward: [0.6, -0.15, 0.8] },
      }),
    ]
  : [];
