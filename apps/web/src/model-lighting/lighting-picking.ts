import { Mesh, type Intersection, type Material, type Object3D } from "three";

export function lightingModelHit(
  root: Object3D,
  hits: readonly Intersection[],
  throughGlass: boolean,
) {
  return hits.find((hit) => {
    if (!(hit.object instanceof Mesh) || hit.object.userData.sceneOutline) return false;
    let parent: Object3D | null = hit.object;
    while (parent && parent !== root) {
      if (parent.userData.modelGlowIgnore || !parent.visible) return false;
      parent = parent.parent;
    }
    if (!parent) return false;
    const mesh = hit.object as Mesh;
    const materials = mesh.material as Material | Material[];
    const material = Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials;
    if (!material?.visible) return false;
    return (
      !throughGlass ||
      !(
        material.transparent ||
        material.opacity < 1 ||
        ("transmission" in material && Number(material.transmission) > 0)
      )
    );
  });
}
