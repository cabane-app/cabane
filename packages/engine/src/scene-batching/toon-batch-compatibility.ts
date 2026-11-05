import {
  BufferAttribute,
  type BufferGeometry,
  type Matrix4,
  Material,
  Mesh,
  MeshToonMaterial,
  type InstancedMesh,
  NormalBlending,
  Object3D,
  StaticDrawUsage,
} from "three";
import { sceneLightMaterialHooks } from "../scene-light-wall-mask";

export function hasBatchableTransform(input: Mesh | Matrix4): boolean {
  const matrix = "matrixWorld" in input ? input.matrixWorld : input;
  if (matrix.determinant() <= 0) return false;
  // Three's batching normal transform supports scale/rotation, not shear.
  const e = matrix.elements;
  for (const [a, b] of [
    [0, 4],
    [0, 8],
    [4, 8],
  ]) {
    const dot = e[a] * e[b] + e[a + 1] * e[b + 1] + e[a + 2] * e[b + 2];
    const aa = e[a] ** 2 + e[a + 1] ** 2 + e[a + 2] ** 2;
    const bb = e[b] ** 2 + e[b + 1] ** 2 + e[b + 2] ** 2;
    if (dot * dot > 1e-10 * aa * bb) return false;
  }
  return true;
}

/** After membership is checked, only fade overrides and transforms can differ. */
export function canRenderToonBatch(mesh: Mesh, validateTransform = true): boolean {
  const material = mesh.material as MeshToonMaterial;
  return (
    !material.transparent &&
    material.opacity === 1 &&
    material.depthWrite === (material.userData.cameraFadeBaseDepthWrite ?? material.depthWrite) &&
    mesh.castShadow === (mesh.userData.cameraFadeBaseCastShadow ?? mesh.castShadow) &&
    (!validateTransform || hasBatchableTransform(mesh))
  );
}

export function hasOrderedGroupAncestor(object: Object3D) {
  for (let parent = object.parent; parent; parent = parent.parent) {
    if (parent.type === "Group" && parent.renderOrder !== 0) return true;
  }
  return false;
}

/** Conservative eligibility: preserve custom shaders, transparency and deformation. */
export function isToonBatchCompatible(
  mesh: Mesh,
  allowInstances = false,
  cacheMembership = false,
): boolean {
  return (
    !hasOrderedGroupAncestor(mesh) && isToonBatchCandidate(mesh, allowInstances, cacheMembership)
  );
}

function isToonBatchCandidate(mesh: Mesh, allowInstances: boolean, cacheMembership: boolean) {
  const instances = mesh as InstancedMesh;
  if (instances.isInstancedMesh && (!allowInstances || instances.morphTexture)) return false;
  const material = mesh.material as MeshToonMaterial;
  if (Array.isArray(material) || !material.isMeshToonMaterial) return false;
  const hooks = sceneLightMaterialHooks(material);
  const fade = material.userData;
  const transparent = cacheMembership
    ? ((fade.cameraFadeBaseTransparent as boolean | undefined) ?? material.transparent)
    : material.transparent;
  const opacity = cacheMembership
    ? ((fade.cameraFadeBaseOpacity as number | undefined) ?? material.opacity)
    : material.opacity;
  if (
    mesh.type !== "Mesh" ||
    Array.isArray(material) ||
    !material.isMeshToonMaterial ||
    !material.visible ||
    transparent ||
    opacity !== 1 ||
    material.wireframe ||
    material.blending !== NormalBlending ||
    material.alphaTest ||
    material.alphaHash ||
    material.alphaToCoverage ||
    material.stencilWrite ||
    material.clippingPlanes?.length ||
    mesh.customDepthMaterial ||
    mesh.customDistanceMaterial ||
    mesh.morphTargetInfluences ||
    mesh.onBeforeRender !== Object3D.prototype.onBeforeRender ||
    mesh.onAfterRender !== Object3D.prototype.onAfterRender ||
    mesh.onBeforeShadow !== Object3D.prototype.onBeforeShadow ||
    mesh.onAfterShadow !== Object3D.prototype.onAfterShadow ||
    hooks.onBeforeCompile !== Material.prototype.onBeforeCompile ||
    hooks.customProgramCacheKey !== Material.prototype.customProgramCacheKey ||
    material.map ||
    material.alphaMap ||
    material.normalMap ||
    material.bumpMap ||
    material.displacementMap ||
    material.emissiveMap ||
    material.aoMap ||
    material.lightMap ||
    (!cacheMembership && !hasBatchableTransform(mesh))
  )
    return false;
  const geometry = mesh.geometry;
  if (
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count <
      (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) ||
    Object.keys(geometry.morphAttributes).length
  )
    return false;
  for (const name of material.vertexColors
    ? ["position", "normal", "color"]
    : ["position", "normal"]) {
    const attribute = geometry.attributes[name];
    if (
      !(attribute instanceof BufferAttribute) ||
      attribute.itemSize !== 3 ||
      !(attribute.array instanceof Float32Array) ||
      attribute.usage !== StaticDrawUsage ||
      attribute.normalized
    )
      return false;
  }
  return true;
}

type GroupValue = string | number | boolean | null | undefined;
const groupKeys = new WeakMap<Mesh, { values: GroupValue[]; key: string }>();

/** The batch collector has already excluded sources under ordered groups. */
export function toonBatchKey(mesh: Mesh): string | null {
  if (!isToonBatchCandidate(mesh, false, true)) return null;
  const material = mesh.material as MeshToonMaterial;
  const depthWrite =
    (material.userData.cameraFadeBaseDepthWrite as boolean | undefined) ?? material.depthWrite;
  const castShadow =
    (mesh.userData.cameraFadeBaseCastShadow as boolean | undefined) ?? mesh.castShadow;
  const values: GroupValue[] = [
    material.gradientMap?.uuid ?? "",
    JSON.stringify(material.defines),
    material.emissive.r,
    material.emissive.g,
    material.emissive.b,
    material.emissiveIntensity,
    material.precision,
    material.vertexColors,
    material.side,
    material.shadowSide,
    material.depthTest,
    depthWrite,
    material.depthFunc,
    material.colorWrite,
    material.toneMapped,
    material.fog,
    material.dithering,
    material.polygonOffset,
    material.polygonOffsetFactor,
    material.polygonOffsetUnits,
    material.blending,
    material.premultipliedAlpha,
    castShadow,
    mesh.receiveShadow,
    mesh.layers.mask,
    mesh.renderOrder,
    mesh.frustumCulled,
  ];
  const previous = groupKeys.get(mesh);
  if (previous && values.every((value, index) => value === previous.values[index]))
    return previous.key;
  // Direct material edits need no needsUpdate flag. Compare every grouping input
  // before reusing its string, including define contents and emissive channels.
  const key = [values[0], values[1], material.emissive.getHexString(), ...values.slice(5)].join(
    "|",
  );
  groupKeys.set(mesh, { values, key });
  return key;
}

type Revision = {
  index: BufferGeometry["index"];
  position: BufferGeometry["attributes"][string];
  normal: BufferGeometry["attributes"][string];
  color: BufferGeometry["attributes"][string];
  indexVersion: number | undefined;
  positionVersion: number | undefined;
  normalVersion: number | undefined;
  colorVersion: number | undefined;
  token: string;
};
const revisions = new WeakMap<BufferGeometry, Revision>();
let nextRevision = 0;
export function geometryRevision(input: Mesh | BufferGeometry): string {
  const geometry = (input as Mesh).geometry ?? (input as BufferGeometry);
  const {
    index,
    attributes: { position, normal, color },
  } = geometry;
  const pv = (position as BufferAttribute | undefined)?.version;
  const nv = (normal as BufferAttribute | undefined)?.version;
  const cv = (color as BufferAttribute | undefined)?.version;
  let revision = revisions.get(geometry);
  if (
    !revision ||
    revision.index !== index ||
    revision.indexVersion !== index?.version ||
    revision.position !== position ||
    revision.positionVersion !== pv ||
    revision.normal !== normal ||
    revision.normalVersion !== nv ||
    revision.color !== color ||
    revision.colorVersion !== cv
  ) {
    revision = {
      index,
      position,
      normal,
      color,
      indexVersion: index?.version,
      positionVersion: pv,
      normalVersion: nv,
      colorVersion: cv,
      token: String(++nextRevision),
    };
    revisions.set(geometry, revision);
  }
  return revision.token;
}
