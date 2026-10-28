import { Color, Mesh, type Material, type Object3D, type BufferGeometry } from "three";
import { lightBrightnessRatio, lightColorForSnapshot } from "../home-assistant-controls";
import type { CustomModelLight } from "../imported-models/contracts";
import type { EntityStateSnapshot } from "../types";
import { modelLightingSurfaceAt } from "./surfaces";

type Emissive = Material & { emissive: Color; emissiveIntensity: number };

/** A mounted editor scene owns mutable materials for its entire lifetime.
 * The target resolver remains the shared surface owner. Geometry/maps stay leased.
 */
export function controlPreviewLightMaterials(root: Object3D) {
  const originals = new Map<Mesh, Material | Material[]>();
  const surfaces: { id: string; original: Emissive; material: Emissive }[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const owned = materials.map((original, index) => {
      const id = modelLightingSurfaceAt(root, mesh, index);
      if (
        !id ||
        !("emissive" in original) ||
        !(original.emissive instanceof Color) ||
        !("emissiveIntensity" in original)
      )
        return original;
      const material = original.clone() as Emissive;
      material.onBeforeCompile = (shader, renderer) => original.onBeforeCompile(shader, renderer);
      material.customProgramCacheKey = () => original.customProgramCacheKey();
      surfaces.push({ id, original: original as Emissive, material });
      return material;
    });
    if (owned.some((material, index) => material !== materials[index])) {
      originals.set(mesh, mesh.material);
      mesh.material = Array.isArray(mesh.material) ? owned : owned[0];
    }
  });
  let disposed = false;
  return {
    update(light: CustomModelLight | null, state: EntityStateSnapshot, highlighted?: string) {
      if (disposed) return;
      const color = lightColorForSnapshot(state, light?.color ?? "#ffe3b4");
      const intensity = lightBrightnessRatio(state);
      for (const { id, original, material } of surfaces) {
        if (id === highlighted) {
          material.emissive.set("#398b66");
          material.emissiveIntensity = 1.3;
        } else if (
          light?.emissiveSurfaces?.includes(id) ||
          light?.emissiveMaterials?.includes(original.name)
        ) {
          material.emissive.set(color);
          material.emissiveIntensity = intensity;
        } else {
          material.emissive.copy(original.emissive);
          material.emissiveIntensity = original.emissiveIntensity;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, original] of originals) mesh.material = original;
      for (const { material } of surfaces) material.dispose();
    },
  };
}
