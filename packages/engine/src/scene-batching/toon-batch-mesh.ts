import { BatchedMesh, type Mesh, type MeshToonMaterial } from "three";

export function createToonBatchMaterial(sourceMaterial: MeshToonMaterial) {
  const material = sourceMaterial.clone();
  material.defines = { ...sourceMaterial.defines };
  material.color.set(0xffffff);
  material.transparent =
    (sourceMaterial.userData.cameraFadeBaseTransparent as boolean | undefined) ??
    sourceMaterial.transparent;
  material.opacity =
    (sourceMaterial.userData.cameraFadeBaseOpacity as number | undefined) ?? sourceMaterial.opacity;
  material.depthWrite =
    (sourceMaterial.userData.cameraFadeBaseDepthWrite as boolean | undefined) ??
    sourceMaterial.depthWrite;
  // Static geometry bakes transforms/tints once. This avoids the matrix,
  // indirect-ID and color texture fetches of the default batching shader.
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <batching_vertex>",
      "mat4 batchingMatrix = mat4(1.0);",
    );
  };
  material.customProgramCacheKey = () => "cabane-static-toon-batch-v1";
  return material;
}

export function createToonBatchMesh(
  source: Mesh,
  material: MeshToonMaterial,
  count: number,
  vertices: number,
  indices: number,
) {
  const mesh = new BatchedMesh(count, vertices, indices, material);
  mesh.name = "opaque-toon-batch";
  mesh.castShadow =
    (source.userData.cameraFadeBaseCastShadow as boolean | undefined) ?? source.castShadow;
  mesh.receiveShadow = source.receiveShadow;
  mesh.layers.mask = source.layers.mask;
  mesh.renderOrder = source.renderOrder;
  mesh.frustumCulled = false;
  mesh.perObjectFrustumCulled = source.frustumCulled;
  mesh.raycast = () => {};
  mesh.matrixAutoUpdate = false;
  return mesh;
}
