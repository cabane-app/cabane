import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { EquirectangularReflectionMapping, type DataTexture } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

const studioUrl = new URL("./assets/lighting/studio-small-09.hdr", import.meta.url).href;

/** A local studio probe for rough-surface bounce and highlights on glazing. */
export function SceneEnvironment() {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    let active = true;
    let installed: DataTexture | undefined;
    const previous = scene.environment;
    new HDRLoader().load(
      studioUrl,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.mapping = EquirectangularReflectionMapping;
        installed = texture;
        scene.environment = texture;
        invalidate();
      },
      undefined,
      // Direct and hemisphere lighting remain available when the probe cannot load.
      () => {},
    );
    return () => {
      active = false;
      if (scene.environment === installed) scene.environment = previous;
      installed?.dispose();
    };
  }, [scene, invalidate]);
  return null;
}
