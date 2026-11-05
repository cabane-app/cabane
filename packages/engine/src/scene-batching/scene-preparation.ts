import type { Scene } from "three";

type Preparation = { lods?: Promise<void>; batches?: Promise<void> };
const scenes = new WeakMap<Scene, Preparation>();

export function registerSceneGeometryLods(scene: Scene, ready: Promise<void>) {
  const current = scenes.get(scene) ?? {};
  current.lods = ready;
  scenes.set(scene, current);
}

export function registerSceneToonBatches(scene: Scene, ready: Promise<void>) {
  const current = scenes.get(scene) ?? {};
  current.batches = ready;
  scenes.set(scene, current);
}

/** Synchronize deferred geometry before warm measurements or rendered evidence. */
export async function waitForScenePreparation(scene: Scene) {
  for (;;) {
    const { lods, batches } = scenes.get(scene) ?? {};
    await Promise.all([lods, batches]);
    // Publishing worker results can register their batch upload on the next frame.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const current = scenes.get(scene);
    if (lods === current?.lods && batches === current?.batches) return;
  }
}
