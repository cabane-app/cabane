import {
  BatchedMesh,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { geometryLodFamily } from "./geometry-lod-family";
import { canRenderToonBatch, geometryRevision, toonBatchKey } from "./toon-batch-compatibility";

type Batch = {
  mesh: BatchedMesh;
  sources: Mesh[];
  families: Array<readonly BufferGeometry[]>;
  revisions: string[][];
  matrices: Matrix4[];
  colors: Color[];
  geometryIds: Array<Map<BufferGeometry, number>>;
  selectedIds: number[];
};

/** Render-only substitution. Original objects/materials remain intact between frames. */
export class SceneToonBatcher {
  private batches = new Map<string, Batch>();
  private inverse = new Matrix4();
  private matrix = new Matrix4();

  private build(sources: Mesh[]): Batch {
    const families = sources.map((source) => geometryLodFamily(source.geometry));
    const revisions = families.map((family) => family.map(geometryRevision));
    const sourceMaterial = sources[0].material as MeshToonMaterial;
    const material = sourceMaterial.clone();
    material.defines = { ...sourceMaterial.defines };
    material.color.set(0xffffff);
    material.transparent =
      (sourceMaterial.userData.cameraFadeBaseTransparent as boolean | undefined) ??
      sourceMaterial.transparent;
    material.opacity =
      (sourceMaterial.userData.cameraFadeBaseOpacity as number | undefined) ??
      sourceMaterial.opacity;
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
    const geometries = families.flatMap((family) => [...family]);
    const vertices = geometries.reduce(
      (sum, geometry) => sum + geometry.attributes.position.count,
      0,
    );
    const indices = geometries.reduce(
      (sum, geometry) => sum + (geometry.index?.count ?? geometry.attributes.position.count),
      0,
    );
    const mesh = new BatchedMesh(sources.length, vertices, indices, material);
    mesh.name = "opaque-toon-batch";
    mesh.castShadow =
      (sources[0].userData.cameraFadeBaseCastShadow as boolean | undefined) ??
      sources[0].castShadow;
    mesh.receiveShadow = sources[0].receiveShadow;
    mesh.layers.mask = sources[0].layers.mask;
    mesh.renderOrder = sources[0].renderOrder;
    mesh.frustumCulled = false; // Individual bounds are culled by BatchedMesh.
    mesh.perObjectFrustumCulled = sources[0].frustumCulled;
    mesh.raycast = () => {};
    const geometryIds: Batch["geometryIds"] = [];
    const matrices = sources.map((source) =>
      new Matrix4().multiplyMatrices(this.inverse, source.matrixWorld),
    );
    sources.forEach((source, instance) => {
      const ids = new Map<BufferGeometry, number>();
      const tint = source.material as MeshToonMaterial;
      for (const geometry of families[instance]) {
        const packed = new BufferGeometry();
        packed.setAttribute("position", geometry.attributes.position.clone());
        packed.setAttribute("normal", geometry.attributes.normal.clone());
        packed.setIndex(
          geometry.index ??
            Array.from({ length: geometry.attributes.position.count }, (_, index) => index),
        );
        packed.applyMatrix4(matrices[instance]);
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
          const color = geometry.attributes.color;
          colors[vertex * 3] = tint.color.r * (tint.vertexColors ? color.getX(vertex) : 1);
          colors[vertex * 3 + 1] = tint.color.g * (tint.vertexColors ? color.getY(vertex) : 1);
          colors[vertex * 3 + 2] = tint.color.b * (tint.vertexColors ? color.getZ(vertex) : 1);
        }
        packed.setAttribute("color", new Float32BufferAttribute(colors, 3));
        ids.set(geometry, mesh.addGeometry(packed));
        packed.dispose();
      }
      geometryIds.push(ids);
      mesh.addInstance(ids.get(source.geometry)!); // Identity: vertices are baked.
    });
    return {
      mesh,
      sources,
      families,
      revisions,
      matrices,
      geometryIds,
      colors: sources.map((source) => (source.material as MeshToonMaterial).color.clone()),
      selectedIds: sources.map((source, index) => geometryIds[index].get(source.geometry)!),
    };
  }

  private disposeBatch(batch: Batch) {
    batch.mesh.dispose();
    (batch.mesh.material as MeshToonMaterial).dispose();
  }

  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    render: () => void = () => renderer.render(scene, camera),
  ) {
    // Without native multi-draw, Three falls back to individual calls. Avoid
    // paying the batching overhead on those devices.
    if (
      scene.overrideMaterial ||
      !renderer.extensions.has("WEBGL_multi_draw") ||
      renderer.localClippingEnabled ||
      renderer.clippingPlanes.length
    ) {
      render();
      return;
    }
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    const groups = new Map<string, Mesh[]>();
    scene.traverse((object) => {
      const source = object as Mesh;
      if (!source.isMesh) return;
      const key = toonBatchKey(source, false, true);
      if (key === null) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(source);
    });
    for (const [key, batch] of this.batches) {
      if ((groups.get(key)?.length ?? 0) < 2) {
        this.disposeBatch(batch);
        this.batches.delete(key);
      }
    }
    const originals: Array<[Mesh, number]> = [];
    const attached: BatchedMesh[] = [];
    this.inverse.copy(scene.matrixWorld).invert();
    try {
      for (const [key, sources] of groups) {
        if (sources.length < 2) continue;
        let batch = this.batches.get(key);
        if (
          !batch ||
          batch.sources.length !== sources.length ||
          sources.some((source, index) => {
            const family = geometryLodFamily(source.geometry);
            return (
              source !== batch!.sources[index] ||
              family !== batch!.families[index] ||
              family.some(
                (geometry, level) => geometryRevision(geometry) !== batch!.revisions[index][level],
              )
            );
          })
        ) {
          if (batch) this.disposeBatch(batch);
          batch = this.build(sources);
          this.batches.set(key, batch);
        }
        for (let index = 0; index < sources.length; index++) {
          const source = sources[index];
          this.matrix.multiplyMatrices(this.inverse, source.matrixWorld);
          const material = source.material as MeshToonMaterial;
          // Animation/tint changes draw the original mesh, never rewrite static
          // vertex buffers during a frame. Children remain independently eligible.
          let visible =
            canRenderToonBatch(source) &&
            batch.matrices[index].equals(this.matrix) &&
            batch.colors[index].equals(material.color);
          for (let parent: Mesh["parent"] = source; visible && parent; parent = parent.parent)
            visible = parent.visible;
          batch.mesh.setVisibleAt(index, visible);
          if (!visible) continue; // Fading/custom objects keep their ordinary draw.
          const geometryId = batch.geometryIds[index].get(source.geometry)!;
          if (batch.selectedIds[index] !== geometryId) {
            batch.mesh.setGeometryIdAt(index, geometryId);
            batch.selectedIds[index] = geometryId;
          }
          // Layer rejection precedes frustum tests, geometry uploads and depth
          // sorting in Three. Unlike visible=false, it keeps children drawable.
          originals.push([source, source.layers.mask]);
          source.layers.mask = 0;
        }
        scene.add(batch.mesh);
        batch.mesh.matrixWorld.copy(scene.matrixWorld);
        attached.push(batch.mesh);
      }
      render();
    } finally {
      for (const [source, layers] of originals) source.layers.mask = layers;
      for (const mesh of attached) scene.remove(mesh);
    }
  }

  dispose() {
    for (const batch of this.batches.values()) this.disposeBatch(batch);
    this.batches.clear();
  }
}
