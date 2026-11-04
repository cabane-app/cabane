import {
  Matrix4,
  Vector3,
  type InstancedMesh,
  type BufferGeometry,
  type Camera,
  type Mesh,
  type Scene,
} from "three";
import { geometryRevision, isToonBatchCompatible } from "./toon-batch-compatibility";
import type { GeometryLod } from "./geometry-lod";
import { GeometryLodWorker } from "./GeometryLodWorker";
import { forgetGeometryLods, registerGeometryLods } from "./geometry-lod-family";

const scenes = new WeakMap<Scene, SceneGeometryLod>();
/** Synchronize deferred geometry before measurements or rendered evidence capture. */
export async function waitForSceneGeometryLods(scene: Scene) {
  await scenes.get(scene)?.ready;
}

type Entry = { revision: string; levels: GeometryLod[] };
/** Cached, error-limited LODs. Original geometry remains the picking surface. */
export class SceneGeometryLod {
  private entries = new Map<BufferGeometry, Entry>();
  private selected = new WeakMap<Mesh, BufferGeometry>();
  private queue: Array<{ source: BufferGeometry; entry: Entry }> = [];
  private running = false;
  ready: Promise<void> = Promise.resolve();
  private disposed = false;
  private center = new Vector3();
  private instance = new Matrix4();
  private world = new Matrix4();
  private worker = new GeometryLodWorker();
  constructor(
    private invalidate: () => void,
    private prepare: (geometry: BufferGeometry) => Promise<GeometryLod[]> = this.worker.prepare,
  ) {}

  private async drain() {
    if (this.running) return;
    this.running = true;
    const prepared: Array<{ source: BufferGeometry; entry: Entry; levels: GeometryLod[] }> = [];
    while (this.queue.length && !this.disposed) {
      const { source, entry } = this.queue.shift()!;
      if (this.entries.get(source) !== entry) continue;
      const levels = await this.prepare(source);
      if (this.disposed || this.entries.get(source) !== entry)
        levels.forEach((level) => level.geometry.dispose());
      else prepared.push({ source, entry, levels });
    }
    // Publish complete families together; partial worker replies must not cause
    // repeated GPU repacking while the remaining geometry is still preparing.
    for (const { source, entry, levels } of prepared) {
      if (this.disposed || this.entries.get(source) !== entry) {
        levels.forEach((level) => level.geometry.dispose());
      } else {
        entry.levels = levels;
        registerGeometryLods(
          source,
          entry.levels.map((level) => level.geometry),
        );
      }
    }
    this.running = false;
    if (!this.disposed) this.invalidate();
  }

  render(scene: Scene, camera: Camera, viewportHeight: number, draw: () => void) {
    // React StrictMode replays effect cleanup while retaining memoized resources.
    this.disposed = false;
    scenes.set(scene, this);
    if (scene.overrideMaterial) {
      draw();
      return;
    }
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    camera.updateWorldMatrix(true, false);
    const originals: Array<[Mesh, BufferGeometry]> = [];
    const used = new Set<BufferGeometry>();
    try {
      scene.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const source = mesh.geometry;
        if (source.userData.preservePlanarFaces === true) return;
        if ((source.index?.count ?? source.attributes.position.count) < 300) return;
        if (!isToonBatchCompatible(mesh, true, true)) return;
        used.add(source);
        const revision = geometryRevision(mesh);
        let entry = this.entries.get(source);
        if (!entry || entry.revision !== revision) {
          forgetGeometryLods(source);
          entry?.levels.forEach((level) => level.geometry.dispose());
          entry = { revision, levels: [] };
          this.entries.set(source, entry);
          this.queue.push({ source, entry });
        }
        if (!entry.levels.length) return;
        if (!source.boundingSphere) source.computeBoundingSphere();
        const sphere = source.boundingSphere!;
        const projectedScale = (matrix: Matrix4) => {
          const scale = matrix.getMaxScaleOnAxis();
          this.center
            .copy(sphere.center)
            .applyMatrix4(matrix)
            .applyMatrix4(camera.matrixWorldInverse);
          const distance = Math.max(0.001, -this.center.z - sphere.radius * scale);
          const perspective = camera.projectionMatrix.elements[15] === 0;
          return (
            (scale * viewportHeight * camera.projectionMatrix.elements[5]) /
            2 /
            (perspective ? distance : 1)
          );
        };
        const instances = mesh as InstancedMesh;
        let pixelsPerUnit = 0;
        if (instances.isInstancedMesh) {
          // One shared geometry must satisfy the nearest/largest instance.
          // Keep full-detail aggregate bounds for rendering and original picking.
          if (!instances.boundingSphere) instances.computeBoundingSphere();
          for (let index = 0; index < instances.count; index++) {
            instances.getMatrixAt(index, this.instance);
            this.world.multiplyMatrices(mesh.matrixWorld, this.instance);
            pixelsPerUnit = Math.max(pixelsPerUnit, projectedScale(this.world));
          }
        } else pixelsPerUnit = projectedScale(mesh.matrixWorld);
        let geometry = source;
        const previous = this.selected.get(mesh);
        for (const level of entry.levels) {
          // Hysteresis around one CSS pixel of projected geometric/attribute error.
          if (level.error * pixelsPerUnit <= (previous === level.geometry ? 1.2 : 0.8))
            geometry = level.geometry;
        }
        this.selected.set(mesh, geometry);
        if (geometry !== source) {
          originals.push([mesh, source]);
          mesh.geometry = geometry;
        }
      });
      for (const [source, entry] of this.entries) {
        if (!used.has(source)) {
          forgetGeometryLods(source);
          entry.levels.forEach((level) => level.geometry.dispose());
          this.entries.delete(source);
        }
      }
      draw();
    } finally {
      for (const [mesh, geometry] of originals) mesh.geometry = geometry;
      if (this.queue.length && !this.running) this.ready = this.drain();
    }
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    this.worker.dispose();
    for (const [source, entry] of this.entries) {
      forgetGeometryLods(source);
      entry.levels.forEach((level) => level.geometry.dispose());
    }
    this.entries.clear();
  }
}
