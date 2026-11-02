import { controlModelLightMaterials } from "../model-lighting/surfaces";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";

export function importedEmissiveMaterialNames(root: Object3D): string[] {
  const names = new Set<string>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (
        material instanceof MeshStandardMaterial &&
        material.name.trim() &&
        material.name.length <= 128
      )
        names.add(material.name);
  });
  return [...names].sort();
}

/** Backward-compatible named-material entry point. */
export function controlImportedLightMaterials(root: Object3D, names: readonly string[]) {
  return controlModelLightMaterials(root, { emissiveMaterials: names });
}
