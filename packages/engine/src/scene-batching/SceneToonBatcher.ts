import {
  BatchedMesh,
  type BufferGeometry,
  LessEqualDepth,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import { ToonBatchGeometryPacker, type ToonBatchGeometryInput } from "./toon-batch-geometry";
import { geometryLodFamily } from "./geometry-lod-family";
import { registerSceneToonBatches } from "./scene-preparation";
import {
  canRenderToonBatch,
  geometryRevision,
  hasBatchableTransform,
  hasOrderedGroupAncestor,
  toonBatchKey,
} from "./toon-batch-compatibility";

type PackedSource = {
  source: Mesh;
  family: readonly BufferGeometry[];
  revisions: string[];
  input: ToonBatchGeometryInput;
  geometryIds: Map<BufferGeometry, number>;
  selectedId: number;
  worldTransformEligible: boolean;
};
type Batch = {
  mesh: BatchedMesh;
  sources: PackedSource[];
  rootMatrix: Matrix4;
  vertices: number;
  indices: number;
};
type SourceGroup = { root: Object3D; sources: Mesh[] };
type Upload = {
  key: string;
  batch: Batch;
  entry: PackedSource;
  geometry: BufferGeometry;
  revision: string;
};

function sameLinearTransform(left: Matrix4, right: Matrix4) {
  const a = left.elements,
    b = right.elements;
  return [0, 1, 2, 4, 5, 6, 8, 9, 10].every((index) => a[index] === b[index]);
}

/** Render-only substitution. Original objects/materials remain intact between frames. */
export class SceneToonBatcher {
  private batches = new Map<string, Batch>();
  private hidden = new MeshToonMaterial({ visible: false });
  private inverse = new Matrix4();
  private sceneInverse = new Matrix4();
  private matrix = new Matrix4();
  private ancestors: Object3D[] = [];
  private identity = new Matrix4();
  private packer = new ToonBatchGeometryPacker();
  private uploads: Upload[] = [];
  private resolveReady: (() => void) | undefined;
  ready: Promise<void> = Promise.resolve();

  constructor(private partitionLargeScenes = false) {}

  private localMatrix(
    source: Mesh,
    root: Object3D,
    scene: Scene,
    target: Matrix4,
    identityRoot: boolean,
  ) {
    if (identityRoot) return target.copy(source.matrixWorld);
    if (root === scene) return target.multiplyMatrices(this.inverse, source.matrixWorld);
    if (source === root) return target.identity();
    // Root-local ancestor matrices stay bit-identical when only the root moves;
    // inverse(root.world) * source.world would introduce cancellation roundoff.
    this.ancestors.length = 0;
    for (let object: Object3D | null = source; object && object !== root; object = object.parent) {
      // A custom world override need not agree with its authored local matrix.
      if (!object.matrixWorldAutoUpdate) {
        this.ancestors.length = 0;
        return target.multiplyMatrices(this.inverse, source.matrixWorld);
      }
      this.ancestors.push(object);
    }
    target.identity();
    for (let index = this.ancestors.length - 1; index >= 0; index--)
      target.multiply(this.ancestors[index].matrix);
    this.ancestors.length = 0;
    return target;
  }

  private build(sources: Mesh[], root: Object3D, scene: Scene): Batch {
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
    const ordinaryDepth =
      material.depthTest && material.depthWrite && material.depthFunc === LessEqualDepth;
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
    const identityRoot = root.matrixWorld.equals(this.identity);
    const packedSources = sources.map((source): PackedSource => {
      const family = geometryLodFamily(source.geometry);
      const matrix = this.localMatrix(source, root, scene, new Matrix4(), identityRoot);
      return {
        source,
        family,
        revisions: family.map(geometryRevision),
        input: {
          matrix,
          color: (source.material as MeshToonMaterial).color.clone(),
          vertexColors: sourceMaterial.vertexColors,
          transformEligible: hasBatchableTransform(matrix),
          ordinaryDepth,
        },
        geometryIds: new Map(),
        selectedId: -1,
        worldTransformEligible: hasBatchableTransform(source),
      };
    });
    const geometries = packedSources.flatMap(({ family }) => [...family]);
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
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = sources[0].frustumCulled;
    mesh.raycast = () => {};
    mesh.matrixAutoUpdate = false;
    try {
      for (const entry of packedSources) {
        for (const [level, geometry] of entry.family.entries())
          entry.geometryIds.set(
            geometry,
            this.packer.add(mesh, geometry, entry.revisions[level], entry.input),
          );
        entry.selectedId = entry.geometryIds.get(entry.source.geometry)!;
        mesh.addInstance(entry.selectedId);
      }
      return {
        mesh,
        sources: packedSources,
        rootMatrix: root.matrixWorld.clone(),
        vertices,
        indices,
      };
    } catch (error) {
      mesh.dispose();
      material.dispose();
      throw error;
    }
  }

  /** Preserve baked originals when deferred LOD preparation only adds levels. */
  private extendFamilies(key: string, batch: Batch, sources: Mesh[]): boolean {
    if (batch.sources.length !== sources.length) return false;
    const extensions: Array<{
      entry: PackedSource;
      family: readonly BufferGeometry[];
      additions: Array<{ geometry: BufferGeometry; revision: string }>;
    }> = [];
    for (let index = 0; index < sources.length; index++) {
      const entry = batch.sources[index];
      const family = geometryLodFamily(sources[index].geometry);
      if (entry.source !== sources[index] || family.length < entry.family.length) return false;
      for (let level = 0; level < entry.family.length; level++)
        if (
          family[level] !== entry.family[level] ||
          geometryRevision(family[level]) !== entry.revisions[level]
        )
          return false;
      if (family.length > entry.family.length)
        extensions.push({
          entry,
          family,
          additions: family
            .slice(entry.family.length)
            .map((geometry) => ({ geometry, revision: geometryRevision(geometry) })),
        });
    }
    if (!extensions.length) return true;
    for (const { entry, family, additions } of extensions) {
      for (const { geometry, revision } of additions) {
        batch.vertices += geometry.attributes.position.count;
        batch.indices += geometry.index?.count ?? geometry.attributes.position.count;
        this.uploads.push({ key, batch, entry, geometry, revision });
      }
      entry.family = family;
      entry.revisions.push(...additions.map(({ revision }) => revision));
    }
    return true;
  }

  private disposeBatch(batch: Batch) {
    this.uploads = this.uploads.filter((upload) => upload.batch !== batch);
    this.settleReady();
    batch.mesh.dispose();
    (batch.mesh.material as MeshToonMaterial).dispose();
  }

  private settleReady() {
    if (!this.uploads.length) this.suspend();
  }

  private uploadPending() {
    if (!this.uploads.length) return;
    if (!this.resolveReady)
      this.ready = new Promise<void>((resolve) => (this.resolveReady = resolve));
    const deadline = performance.now() + 6;
    // Stop between jobs: one large geometry (including its first exact resize)
    // remains atomic and can exceed the budget. All batches share this deadline.
    while (this.uploads.length) {
      const { key, batch, entry, geometry, revision } = this.uploads.shift()!;
      try {
        const { mesh, vertices, indices } = batch;
        if (
          mesh.geometry.attributes.position.count < vertices ||
          (mesh.geometry.index?.count ?? 0) < indices
        )
          mesh.setGeometrySize(vertices, indices);
        entry.geometryIds.set(geometry, this.packer.add(mesh, geometry, revision, entry.input));
      } catch (error) {
        this.disposeBatch(batch);
        this.batches.delete(key);
        throw error;
      }
      if (performance.now() >= deadline) break;
    }
    this.settleReady();
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
      this.suspend();
      registerSceneToonBatches(scene, this.ready);
      render();
      return false;
    }
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    const materialGroups = new Map<string, SourceGroup>();
    const collect = (
      object: Object3D,
      root: Object3D,
      groupsByMaterial: Map<string, SourceGroup>,
    ) => {
      if (object.userData.toonBatchRoot === true) {
        root = object;
        groupsByMaterial = new Map();
      }
      const source = object as Mesh;
      if (source.isMesh) {
        const materialKey = toonBatchKey(source);
        if (materialKey !== null) {
          let group = groupsByMaterial.get(materialKey);
          if (!group) {
            group = { root, sources: [] };
            groupsByMaterial.set(materialKey, group);
            materialGroups.set(`${root.id}|${materialKey}`, group);
          }
          group.sources.push(source);
        }
      }
      if (object.type === "Group" && object.renderOrder !== 0) return;
      for (const child of object.children) collect(child, root, groupsByMaterial);
    };
    if (!hasOrderedGroupAncestor(scene)) collect(scene, scene, new Map());
    const groups = new Map<string, SourceGroup>();
    for (const [key, group] of materialGroups) {
      const { root, sources } = group;
      if (!this.partitionLargeScenes || sources.length <= 256) {
        groups.set(key, group);
        continue;
      }
      // Keep a local editor change from repacking thousands of unrelated meshes.
      // Stable parent buckets retain model parts together without shifting other
      // sources when an item or an architectural surface is added or removed.
      for (const source of sources) {
        const owner = source.parent === root ? source : (source.parent ?? source);
        const partition = `${key}|partition:${owner.id % 16}`;
        if (!groups.has(partition)) groups.set(partition, { root, sources: [] });
        groups.get(partition)!.sources.push(source);
      }
    }
    for (const [key, batch] of this.batches) {
      if ((groups.get(key)?.sources.length ?? 0) < 2) {
        this.disposeBatch(batch);
        this.batches.delete(key);
      }
    }
    const originals: Array<[Mesh, Mesh["material"], number]> = [];
    const attached: BatchedMesh[] = [];
    const current: Array<{ root: Object3D; batch: Batch }> = [];
    this.sceneInverse.copy(scene.matrixWorld).invert();
    try {
      for (const [key, { root, sources }] of groups) {
        if (sources.length < 2) continue;
        this.inverse.copy(root.matrixWorld).invert();
        let batch = this.batches.get(key);
        if (batch) {
          let reusable: boolean;
          try {
            reusable = this.extendFamilies(key, batch, sources);
          } catch (error) {
            this.disposeBatch(batch);
            this.batches.delete(key);
            throw error;
          }
          if (!reusable) {
            this.disposeBatch(batch);
            this.batches.delete(key);
            batch = undefined;
          }
        }
        if (!batch) {
          batch = this.build(sources, root, scene);
          this.batches.set(key, batch);
        }
        current.push({ root, batch });
      }
      // Every family/revision is checked before any queued job can commit.
      this.uploadPending();
      for (const { root, batch } of current) {
        this.inverse.copy(root.matrixWorld).invert();
        const identityRoot = root.matrixWorld.equals(this.identity);
        const sameRootLinearTransform = sameLinearTransform(batch.rootMatrix, root.matrixWorld);
        for (let index = 0; index < batch.sources.length; index++) {
          const entry = batch.sources[index];
          const { source, input } = entry;
          const matrix = this.localMatrix(source, root, scene, this.matrix, identityRoot);
          const material = source.material as MeshToonMaterial;
          // Animation/tint changes draw the original mesh, never rewrite static
          // vertex buffers during a frame. Children remain independently eligible.
          let visible =
            input.matrix.equals(matrix) &&
            input.transformEligible &&
            input.color.equals(material.color) &&
            // Equal baked matrices retain the same reflection/shear result.
            // Root translations retain that linear result; reflection/shear
            // changes still need world-space validation.
            (sameRootLinearTransform ? entry.worldTransformEligible : true) &&
            canRenderToonBatch(source, !sameRootLinearTransform);
          for (let parent: Mesh["parent"] = source; visible && parent; parent = parent.parent)
            visible = parent.visible;
          batch.mesh.setVisibleAt(index, visible);
          if (!visible) continue; // Fading/custom objects keep their ordinary draw.
          const geometryId =
            entry.geometryIds.get(source.geometry) ?? entry.geometryIds.get(entry.family[0])!;
          if (entry.selectedId !== geometryId) {
            batch.mesh.setGeometryIdAt(index, geometryId);
            entry.selectedId = geometryId;
          }
          // Layer rejection precedes frustum tests, geometry uploads and depth
          // sorting in Three. Unlike visible=false, it keeps children drawable.
          // Retain material masking so downstream lighting preparation also
          // skips the authored materials of these render-only substitutes.
          originals.push([source, source.material, source.layers.mask]);
          source.material = this.hidden;
          source.layers.mask = 0;
        }
        scene.add(batch.mesh);
        if (root === scene) batch.mesh.matrix.identity();
        else batch.mesh.matrix.multiplyMatrices(this.sceneInverse, root.matrixWorld);
        batch.mesh.matrixWorld.copy(root.matrixWorld);
        attached.push(batch.mesh);
      }
      render();
    } finally {
      for (const [source, material, layers] of originals) {
        source.material = material;
        source.layers.mask = layers;
      }
      for (const mesh of attached) scene.remove(mesh);
      registerSceneToonBatches(scene, this.ready);
    }
    return this.uploads.length > 0;
  }

  /** Stop waiting for uploads while no batch frames run, retaining work for resumption. */
  suspend() {
    this.resolveReady?.();
    this.resolveReady = undefined;
  }

  dispose() {
    for (const batch of this.batches.values()) this.disposeBatch(batch);
    this.batches.clear();
    this.ancestors.length = 0;
    this.packer.clear();
    this.hidden.dispose();
  }
}
