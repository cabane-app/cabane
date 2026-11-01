import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Object3D } from "three";
import type { EntityStateSnapshot } from "../types";
import type { CustomModelLight } from "./contracts";
import { controlModelLightMaterials } from "../model-lighting/surfaces";

/** Used by import preview and runtime so both obey the same material lifetime. */
export function ImportedModelSurface({
  root,
  light,
  state,
}: {
  root: Object3D;
  light?: CustomModelLight | undefined;
  state?: EntityStateSnapshot | undefined;
}) {
  const invalidate = useThree((scene) => scene.invalidate);
  const controller = useRef<ReturnType<typeof controlModelLightMaterials> | null>(null);
  const names = light?.emissiveMaterials;
  const surfaces = light?.emissiveSurfaces;
  useLayoutEffect(() => {
    const materials = controlModelLightMaterials(root, {
      ...(names ? { emissiveMaterials: names } : {}),
      ...(surfaces ? { emissiveSurfaces: surfaces } : {}),
    });
    controller.current = materials;
    return () => {
      controller.current = null;
      materials.dispose();
    };
  }, [root, names, surfaces]);
  useLayoutEffect(() => {
    controller.current?.update(state, light?.color ?? "#ffe3b4");
    invalidate();
  }, [root, names, surfaces, state, light?.color, invalidate]);
  return <primitive object={root} dispose={null} />;
}
