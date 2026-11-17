import { Material, type Color, type Mesh, type Object3D, type BufferGeometry } from "three";
import { sceneLightMaterialHooks } from "../scene-point-shadows";
import { lightBrightnessRatio, lightColorForSnapshot } from "../home-assistant-controls";
import type { CustomModelLight } from "../imported-models/contracts";
import type { EntityStateSnapshot } from "../types";

type EmissiveMaterial = Material & { emissive: Color; emissiveIntensity: number };
const emissive = (material: Material): material is EmissiveMaterial =>
  (material as Partial<EmissiveMaterial>).emissive?.isColor === true &&
  "emissiveIntensity" in material;
export interface ModelLightingSurfaceOption {
  id: string;
  label: string;
  supported: boolean;
}

/** Native parts use unique authored keys/names. Immutable GLBs retain their existing ordinals. */
function visitSurfaces(
  root: Object3D,
  visit: (
    mesh: Mesh,
    material: Material,
    index: number,
    option: ModelLightingSurfaceOption,
  ) => void,
) {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (!(object as Mesh).isMesh || object.userData.sceneOutline || object.userData.modelGlowIgnore)
      return;
    for (let parent = object.parent; parent; parent = parent.parent) {
      if (parent.userData.sceneOutline || parent.userData.modelGlowIgnore) return;
      if (parent === root) break;
    }
    meshes.push(object as Mesh);
  });
  const keyFor = (mesh: Mesh): string =>
    typeof mesh.userData.modelGlowKey === "string" ? mesh.userData.modelGlowKey : mesh.name;
  const counts = new Map<string, number>();
  for (const mesh of meshes)
    if (!mesh.userData.importedModel) counts.set(keyFor(mesh), (counts.get(keyFor(mesh)) ?? 0) + 1);
  let ordinal = 0;
  meshes.forEach((object) => {
    if (!object.visible) return;
    const order = ordinal++;
    const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const key = encodeURIComponent(keyFor(mesh));
    const native =
      !!key && key.length <= 100 && counts.get(keyFor(mesh)) === 1 && materials.length === 1;
    materials.forEach((material, index) =>
      visit(mesh, material, index, {
        id: mesh.userData.importedModel
          ? `surface:${order}:${index}`
          : native
            ? `surface:key:${key}`
            : `unavailable:${order}:${index}`,
        label:
          object.name ||
          material.name ||
          `Surface ${order + 1}${materials.length > 1 ? ` · ${index + 1}` : ""}`,
        supported: emissive(material) && (!!mesh.userData.importedModel || native),
      }),
    );
  });
}
export function modelLightingSurfaces(root: Object3D): ModelLightingSurfaceOption[] {
  const options: ModelLightingSurfaceOption[] = [];
  visitSurfaces(root, (_mesh, _material, _index, option) => options.push(option));
  return options;
}
export function modelLightingSurfaceAt(
  root: Object3D,
  mesh: Object3D,
  materialIndex = 0,
): string | undefined {
  let id: string | undefined;
  visitSurfaces(root, (candidate, _material, index, option) => {
    if (candidate === mesh && index === materialIndex && option.supported) id = option.id;
  });
  return id;
}

/** Own selected materials per copy. Geometry, maps and unselected materials remain shared. */
export function controlModelLightMaterials(
  root: Object3D,
  light: Pick<CustomModelLight, "emissiveMaterials" | "emissiveSurfaces">,
  highlighted?: string,
) {
  const selectedNames = new Set(light.emissiveMaterials ?? []);
  const selectedSurfaces = new Set(light.emissiveSurfaces ?? []);
  const originals = new Map<Mesh, Material | Material[]>();
  const shadowCasters = new Map<Mesh, boolean>();
  const emittingMaterials = new Set<Material>();
  const clones = new Map<Material, EmissiveMaterial>();
  const highlightedClones = new Set<EmissiveMaterial>();
  visitSurfaces(root, (mesh, original, index, option) => {
    const highlight = option.supported && option.id === highlighted;
    if (
      !emissive(original) ||
      (!selectedNames.has(original.name) &&
        !(option.supported && selectedSurfaces.has(option.id)) &&
        !highlight)
    )
      return;
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    let instance = highlight ? undefined : clones.get(original);
    if (!instance) {
      instance = original.clone() as EmissiveMaterial;
      const hooks = sceneLightMaterialHooks(original);
      if (hooks.onBeforeCompile !== Material.prototype.onBeforeCompile)
        instance.onBeforeCompile = (shader, renderer) =>
          hooks.onBeforeCompile.call(original, shader, renderer);
      if (hooks.customProgramCacheKey !== Material.prototype.customProgramCacheKey)
        instance.customProgramCacheKey = () => hooks.customProgramCacheKey.call(original);
      if (highlight) highlightedClones.add(instance);
      else clones.set(original, instance);
    }
    if (selectedNames.has(original.name) || (option.supported && selectedSurfaces.has(option.id)))
      emittingMaterials.add(instance);
    if (Array.isArray(mesh.material)) {
      mesh.material = [...mesh.material];
      mesh.material[index] = instance;
    } else mesh.material = instance;
  });
  for (const mesh of originals.keys()) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.every((material) => emittingMaterials.has(material))) {
      shadowCasters.set(mesh, mesh.castShadow);
      mesh.castShadow = false;
    }
  }
  let disposed = false;
  return {
    update(state: EntityStateSnapshot | undefined, fallback: string) {
      for (const material of clones.values()) {
        material.emissive.set(lightColorForSnapshot(state, fallback));
        material.emissiveIntensity = lightBrightnessRatio(state);
      }
      for (const material of highlightedClones) {
        material.emissive.set("#398b66");
        material.emissiveIntensity = 1.3;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, original] of originals) mesh.material = original;
      for (const [mesh, castShadow] of shadowCasters) mesh.castShadow = castShadow;
      for (const material of [...clones.values(), ...highlightedClones]) material.dispose();
    },
  };
}
