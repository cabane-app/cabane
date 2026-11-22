import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { EquirectangularReflectionMapping, type DataTexture } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

const studioUrl = new URL("./assets/lighting/studio-small-09.hdr", import.meta.url).href;

/** A local studio probe for rough-surface bounce and highlights on glazing. */
export function SceneEnvironment({
  active,
  pending,
}: {
  active: boolean;
  pending: RefObject<boolean>;
}) {
  const { scene, invalidate } = useThree();
  const [started, setStarted] = useState(active);
  const [texture, setTexture] = useState<DataTexture | null>(null);
  if (active && !started) setStarted(true);
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let owned: DataTexture | undefined;
    pending.current = true;
    new HDRLoader().load(
      studioUrl,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.mapping = EquirectangularReflectionMapping;
        owned = loaded;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (!cancelled) {
          pending.current = false;
          invalidate();
        }
      },
    );
    return () => {
      cancelled = true;
      owned?.dispose();
    };
  }, [started, invalidate, pending]);
  useLayoutEffect(() => {
    if (!active || !texture) return;
    const previous = scene.environment;
    scene.environment = texture;
    pending.current = false;
    invalidate();
    return () => {
      if (scene.environment === texture) scene.environment = previous;
    };
  }, [active, texture, scene, invalidate, pending]);
  return null;
}
