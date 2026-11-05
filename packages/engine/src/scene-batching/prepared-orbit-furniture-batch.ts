import {
  Box3,
  Group,
  LessEqualDepth,
  Material,
  Mesh,
  Object3D,
  Sphere,
  type BatchedMesh,
  type BufferGeometry,
  type MeshToonMaterial,
} from "three";
import { sceneLightMaterialHooks } from "../scene-light-wall-mask";
import type { GeometryLod } from "./geometry-lod";
import {
  canRenderToonBatch,
  geometryRevision,
  isToonBatchCompatible,
  toonBatchKey,
} from "./toon-batch-compatibility";
import { ToonBatchGeometryPacker } from "./toon-batch-geometry";
import { createToonBatchMaterial, createToonBatchMesh } from "./toon-batch-mesh";

export type PreparedSource = {
  proxy: Mesh;
  geometry: BufferGeometry;
  key: string | null;
  lodEligible: boolean;
  scale: number;
};

type PreparedInstance = {
  ids: number[];
  levels: readonly GeometryLod[];
  scale: number;
  selected: number;
};

type PreparedBatch = {
  mesh: BatchedMesh;
  instances: PreparedInstance[];
};

export type PreparedChunk = {
  root: Group;
  batches: PreparedBatch[];
  ordinary: Array<{ source: PreparedSource; levels: readonly GeometryLod[]; selected: number }>;
};

const noRaycast = () => {};

function hasCustomObjectHooks(object: Object3D) {
  return (
    object.onBeforeRender !== Object3D.prototype.onBeforeRender ||
    object.onAfterRender !== Object3D.prototype.onAfterRender ||
    object.onBeforeShadow !== Object3D.prototype.onBeforeShadow ||
    object.onAfterShadow !== Object3D.prototype.onAfterShadow
  );
}

function hasCustomMaterialHooks(material: Material) {
  const hooks = sceneLightMaterialHooks(material);
  return (
    hooks.onBeforeCompile !== Material.prototype.onBeforeCompile ||
    hooks.onBeforeRender !== Material.prototype.onBeforeRender ||
    hooks.customProgramCacheKey !== Material.prototype.customProgramCacheKey
  );
}

function supportsPreparedMaterial(material: Material, castShadow: boolean) {
  if (
    material.type !== "MeshToonMaterial" &&
    material.type !== "MeshBasicMaterial" &&
    material.type !== "MeshStandardMaterial" &&
    material.type !== "MeshPhysicalMaterial"
  )
    return false;
  if (material.userData.cameraFadeBaseOpacity !== undefined || hasCustomMaterialHooks(material))
    return false;
  if (!castShadow) return true;
  const toon = material as MeshToonMaterial & { displacementMap?: unknown };
  return (
    toon.isMeshToonMaterial &&
    material.alphaTest === 0 &&
    !material.alphaHash &&
    !material.alphaToCoverage &&
    !material.clippingPlanes?.length &&
    !toon.map &&
    !toon.alphaMap &&
    !toon.displacementMap
  );
}

/** Admit only immutable ordinary meshes. The adapter owns certification of the authored model. */
export function snapshotPreparedSources(root: Object3D): PreparedSource[] | null {
  root.updateWorldMatrix(true, true);
  const sources: PreparedSource[] = [];
  let supported = true;
  root.traverseVisible((object) => {
    if (!supported) return;
    if (
      hasCustomObjectHooks(object) ||
      object.userData.importedModel === true ||
      object.userData.walkToolVisual === true
    ) {
      supported = false;
      return;
    }
    if (object.type === "Group" || object.type === "Object3D") {
      supported = object.renderOrder === 0;
      return;
    }
    const mesh = object as Mesh;
    if (
      !mesh.isMesh ||
      mesh.type !== "Mesh" ||
      "isInstancedMesh" in mesh ||
      mesh.customDepthMaterial ||
      mesh.customDistanceMaterial ||
      mesh.morphTargetInfluences ||
      mesh.userData.cameraFadeBaseCastShadow !== undefined ||
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(
        (material) => !supportsPreparedMaterial(material, mesh.castShadow),
      )
    ) {
      supported = false;
      return;
    }
    // Proxies share the source's geometry and materials. The prepared module only owns packed copies.
    const proxy = new Mesh(mesh.geometry, mesh.material);
    proxy.name = mesh.name;
    proxy.matrix.copy(mesh.matrixWorld);
    proxy.matrixAutoUpdate = false;
    proxy.layers.mask = mesh.layers.mask;
    proxy.castShadow = mesh.castShadow;
    proxy.receiveShadow = mesh.receiveShadow;
    proxy.renderOrder = mesh.renderOrder;
    proxy.frustumCulled = mesh.frustumCulled;
    proxy.raycast = noRaycast;
    const key = canRenderToonBatch(mesh) ? toonBatchKey(mesh) : null;
    sources.push({
      proxy,
      geometry: mesh.geometry,
      key,
      lodEligible: key !== null || isToonBatchCompatible(mesh, true, true),
      scale: proxy.matrix.getMaxScaleOnAxis(),
    });
  });
  return supported && sources.length ? sources : null;
}

function buildBatch(
  sources: readonly PreparedSource[],
  lods: (geometry: BufferGeometry) => readonly GeometryLod[],
  packer: ToonBatchGeometryPacker,
): PreparedBatch {
  const first = sources[0].proxy;
  const sourceMaterial = first.material as MeshToonMaterial;
  const levels = sources.map(({ geometry }) => lods(geometry));
  let vertices = 0;
  let indices = 0;
  const countGeometry = (geometry: BufferGeometry) => {
    const count = geometry.attributes.position.count;
    vertices += count;
    indices += geometry.index?.count ?? count;
  };
  for (let index = 0; index < sources.length; index++) {
    countGeometry(sources[index].geometry);
    for (const { geometry } of levels[index]) countGeometry(geometry);
  }
  const material = createToonBatchMaterial(sourceMaterial);
  const mesh = createToonBatchMesh(first, material, sources.length, vertices, indices);
  mesh.name = "prepared-orbit-batch";
  const bounds = new Box3();
  const scratch = new Box3();
  try {
    const instances = sources.map(({ proxy, geometry, scale }, index): PreparedInstance => {
      const input = {
        matrix: proxy.matrix,
        color: (proxy.material as MeshToonMaterial).color,
        vertexColors: sourceMaterial.vertexColors,
        transformEligible: true,
        ordinaryDepth:
          material.depthTest && material.depthWrite && material.depthFunc === LessEqualDepth,
      };
      const ids = [geometry, ...levels[index].map(({ geometry }) => geometry)].map((geometry) => {
        const id = packer.add(mesh, geometry, geometryRevision(geometry), input);
        mesh.getBoundingBoxAt(id, scratch);
        bounds.union(scratch);
        return id;
      });
      mesh.addInstance(ids[0]);
      return { ids, levels: levels[index], scale, selected: 0 };
    });
    // Three tests the whole chunk against the current beauty or shadow frustum before
    // BatchedMesh culls its individual instances. Include all selectable geometry.
    if (first.frustumCulled && !bounds.isEmpty()) {
      mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
      mesh.frustumCulled = true;
    }
    return { mesh, instances };
  } catch (error) {
    mesh.dispose();
    material.dispose();
    throw error;
  }
}

export function buildPreparedChunk(
  sources: readonly PreparedSource[],
  lods: (geometry: BufferGeometry) => readonly GeometryLod[],
  packer: ToonBatchGeometryPacker,
): PreparedChunk {
  const root = new Group();
  const chunk: PreparedChunk = { root, batches: [], ordinary: [] };
  const groups = new Map<string, PreparedSource[]>();
  for (const source of sources) {
    if (source.key === null) continue;
    const existing = groups.get(source.key);
    if (existing) existing.push(source);
    else groups.set(source.key, [source]);
  }
  try {
    for (const [key, group] of groups) {
      if (group.length < 2) {
        groups.delete(key);
        continue;
      }
      const batch = buildBatch(group, lods, packer);
      root.add(batch.mesh);
      chunk.batches.push(batch);
    }
  } catch (error) {
    disposePreparedChunk(chunk);
    throw error;
  }
  for (const source of sources) {
    if (source.key !== null && groups.has(source.key)) continue;
    source.proxy.geometry = source.geometry;
    root.add(source.proxy);
    const levels = source.lodEligible ? lods(source.geometry) : [];
    if (levels.length) chunk.ordinary.push({ source, levels, selected: 0 });
  }
  return chunk;
}

function selectLevel(levels: readonly GeometryLod[], previous: number, pixelsPerUnit: number) {
  let selected = 0;
  for (let index = 0; index < levels.length; index++) {
    if (levels[index].error * pixelsPerUnit <= (previous === index + 1 ? 1.2 : 0.8))
      selected = index + 1;
  }
  return selected;
}

export function selectPreparedChunkLod(chunk: PreparedChunk, pixelsPerUnit: number) {
  for (const { mesh, instances } of chunk.batches) {
    for (let index = 0; index < instances.length; index++) {
      const entry = instances[index];
      const selected = selectLevel(entry.levels, entry.selected, entry.scale * pixelsPerUnit);
      if (selected !== entry.selected) {
        mesh.setGeometryIdAt(index, entry.ids[selected]);
        entry.selected = selected;
      }
    }
  }
  for (const entry of chunk.ordinary) {
    const { source, levels } = entry;
    const selected = selectLevel(levels, entry.selected, source.scale * pixelsPerUnit);
    if (selected !== entry.selected) {
      source.proxy.geometry = selected === 0 ? source.geometry : levels[selected - 1].geometry;
      entry.selected = selected;
    }
  }
}

export function disposePreparedChunk(chunk: PreparedChunk) {
  chunk.root.clear();
  for (const { mesh } of chunk.batches) {
    mesh.dispose();
    (mesh.material as Material).dispose();
  }
}
