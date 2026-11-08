import {
  BufferAttribute,
  type BufferGeometry,
  Material,
  Mesh,
  MeshToonMaterial,
  type InstancedMesh,
  NormalBlending,
  Object3D,
  StaticDrawUsage,
} from "three";
import { sceneLightMaterialHooks } from "../scene-light-wall-mask";

const basisPairs = [
  [0, 4],
  [0, 8],
  [4, 8],
] as const;
const shapeAttributes = ["position", "normal"];
const tintedShapeAttributes = [...shapeAttributes, "color"];

function hasBatchableTransform(mesh: Mesh): boolean {
  if (mesh.matrixWorld.determinant() <= 0) return false;
  // Three's batching normal transform supports scale/rotation, not shear.
  const e = mesh.matrixWorld.elements;
  for (const [a, b] of basisPairs) {
    const dot = e[a] * e[b] + e[a + 1] * e[b + 1] + e[a + 2] * e[b + 2];
    const aa = e[a] ** 2 + e[a + 1] ** 2 + e[a + 2] ** 2;
    const bb = e[b] ** 2 + e[b + 1] ** 2 + e[b + 2] ** 2;
    if (dot * dot > 1e-10 * aa * bb) return false;
  }
  return true;
}

/** After membership is checked, only fade overrides and transforms can differ. */
export function canRenderToonBatch(mesh: Mesh): boolean {
  const material = mesh.material as MeshToonMaterial;
  return (
    !material.transparent &&
    material.opacity === 1 &&
    material.depthWrite === (material.userData.cameraFadeBaseDepthWrite ?? material.depthWrite) &&
    mesh.castShadow === (mesh.userData.cameraFadeBaseCastShadow ?? mesh.castShadow) &&
    hasBatchableTransform(mesh)
  );
}

/** Conservative eligibility: preserve custom shaders, transparency and deformation. */
export function isToonBatchCompatible(
  mesh: Mesh,
  allowInstances = false,
  cacheMembership = false,
): boolean {
  for (let parent = mesh.parent; parent; parent = parent.parent) {
    if (parent.type === "Group" && parent.renderOrder !== 0) return false;
  }
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
  for (const name of material.vertexColors ? tintedShapeAttributes : shapeAttributes) {
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

const groupKeys = new WeakMap<Mesh, { fields: readonly unknown[]; key: string }>();

/** Only batching needs a serialized material group; LOD needs eligibility alone. */
export function toonBatchKey(
  mesh: Mesh,
  allowInstances = false,
  cacheMembership = false,
): string | null {
  if (
    mesh.userData.skipStaticBatch === true ||
    !isToonBatchCompatible(mesh, allowInstances, cacheMembership)
  )
    return null;
  const material = mesh.material as MeshToonMaterial;
  const depthWrite = cacheMembership
    ? ((material.userData.cameraFadeBaseDepthWrite as boolean | undefined) ?? material.depthWrite)
    : material.depthWrite;
  const castShadow = cacheMembership
    ? ((mesh.userData.cameraFadeBaseCastShadow as boolean | undefined) ?? mesh.castShadow)
    : mesh.castShadow;
  const fields = [
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
  // Three materials permit direct property edits without a version bump.
  const previous = groupKeys.get(mesh);
  if (previous && fields.every((field, index) => field === previous.fields[index]))
    return previous.key;
  const key = fields.join("|");
  groupKeys.set(mesh, { fields, key });
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
