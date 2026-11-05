import { Group, type BufferGeometry, type Camera, type Object3D } from "three";
import type { GeometryLod } from "./geometry-lod";
import { GeometryLodWorker } from "./GeometryLodWorker";
import {
  buildPreparedChunk,
  disposePreparedChunk,
  selectPreparedChunkLod,
  snapshotPreparedSources,
  type PreparedChunk,
  type PreparedSource,
} from "./prepared-orbit-furniture-batch";
import { markPreparedOrbitRenderRoot } from "./prepared-orbit-render-root";
import { ToonBatchGeometryPacker } from "./toon-batch-geometry";

export { preparedOrbitShadowRevision } from "./prepared-orbit-render-root";

type Chunk = {
  root: Group;
  items: Map<string, PreparedSource[]>;
  prepared?: PreparedChunk;
};

type LodEntry = {
  geometry: BufferGeometry;
  levels: readonly GeometryLod[];
  chunks: Map<Chunk, number>;
};

const CHUNK_SIZE_METERS = 4;
const EMPTY_LODS: readonly GeometryLod[] = [];

/** Own persistent static render outputs; original source objects remain with the authoring adapter. */
export class PreparedOrbitFurniture {
  readonly root = new Group();
  private chunks = new Map<string, Chunk>();
  private items = new Map<string, { key: string; chunk: Chunk; sources: PreparedSource[] }>();
  private dirty = new Set<Chunk>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lods = new Map<BufferGeometry, LodEntry>();
  private lodQueue = new Set<LodEntry>();
  private runningLod = false;
  private worker = new GeometryLodWorker();
  private packer = new ToonBatchGeometryPacker();
  private epoch = 0;
  private revision = 0;
  private buildCount = 0;
  private meshCount = 0;
  private pixelsPerUnit = Infinity;

  constructor(private invalidate: () => void = () => {}) {
    this.root.name = "prepared-orbit-furniture";
    Object.defineProperty(this.root.userData, "preparedOrbitFurniture", {
      get: () => this.stats,
    });
    markPreparedOrbitRenderRoot(this.root, this.revision);
  }

  get stats() {
    return {
      items: this.items.size,
      sourceMeshes: this.meshCount,
      chunks: this.chunks.size,
      builds: this.buildCount,
      pendingChunks: this.dirty.size,
      pendingLods: this.lodQueue.size + Number(this.runningLod),
    };
  }

  /**
   * The detached root is in floor-local coordinates under an identity parent.
   * The adapter re-registers on every change to authored geometry, transform, or material.
   * Null requests the ordinary live rendering path for this whole item.
   */
  register(
    id: string,
    source: Object3D,
    position: readonly [number, number, number],
  ): (() => void) | null {
    this.unregister(id);
    const sources = snapshotPreparedSources(source);
    if (!sources) return null;
    const x = Math.floor(position[0] / CHUNK_SIZE_METERS);
    const z = Math.floor(position[2] / CHUNK_SIZE_METERS);
    const key = `${x}:${z}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const root = new Group();
      root.name = `prepared-orbit-chunk:${key}`;
      chunk = { root, items: new Map() };
      this.chunks.set(key, chunk);
      this.root.add(root);
    }
    this.restoreProxies(chunk);
    chunk.items.set(id, sources);
    for (const entry of sources) {
      chunk.root.add(entry.proxy);
      this.retainLod(chunk, entry);
    }
    const item = { key, chunk, sources };
    this.items.set(id, item);
    this.meshCount += sources.length;
    this.dirty.add(chunk);
    this.changed();
    this.schedule();
    return () => {
      if (this.items.get(id) === item) this.unregister(id);
    };
  }

  /** Camera-only selection. Orthographic panning does not change projected scale. */
  prepare(camera: Camera, viewportHeight: number): boolean {
    const projection = camera.projectionMatrix.elements;
    const scale = projection[15] === 0 ? Infinity : (projection[5] * viewportHeight) / 2;
    if (scale !== this.pixelsPerUnit) {
      this.pixelsPerUnit = scale;
      for (const { prepared } of this.chunks.values()) {
        if (prepared) selectPreparedChunkLod(prepared, scale);
      }
    }
    return this.dirty.size > 0 || this.runningLod || this.lodQueue.size > 0;
  }

  private changed() {
    markPreparedOrbitRenderRoot(this.root, ++this.revision);
    this.invalidate();
  }

  private unregister(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    const { chunk, sources, key } = item;
    this.restoreProxies(chunk);
    for (const entry of sources) {
      chunk.root.remove(entry.proxy);
      if (entry.lodEligible) this.releaseLod(chunk, entry.geometry);
    }
    chunk.items.delete(id);
    this.items.delete(id);
    this.meshCount -= sources.length;
    if (chunk.items.size === 0) {
      this.dirty.delete(chunk);
      this.chunks.delete(key);
      this.root.remove(chunk.root);
    } else {
      this.dirty.add(chunk);
      this.schedule();
    }
    this.changed();
  }

  private restoreProxies(chunk: Chunk) {
    if (!chunk.prepared) return;
    chunk.root.remove(chunk.prepared.root);
    disposePreparedChunk(chunk.prepared);
    delete chunk.prepared;
    for (const sources of chunk.items.values()) {
      for (const { proxy, geometry } of sources) {
        proxy.geometry = geometry;
        chunk.root.add(proxy);
      }
    }
  }

  private retainLod(chunk: Chunk, { lodEligible, geometry }: PreparedSource) {
    if (
      !lodEligible ||
      geometry.userData.preservePlanarFaces === true ||
      (geometry.index?.count ?? geometry.attributes.position.count) < 300
    )
      return;
    let entry = this.lods.get(geometry);
    if (!entry) {
      entry = { geometry, levels: EMPTY_LODS, chunks: new Map() };
      this.lods.set(geometry, entry);
      this.lodQueue.add(entry);
    }
    entry.chunks.set(chunk, (entry.chunks.get(chunk) ?? 0) + 1);
  }

  private releaseLod(chunk: Chunk, geometry: BufferGeometry) {
    const entry = this.lods.get(geometry);
    const references = entry?.chunks.get(chunk);
    if (!entry || references === undefined) return;
    if (references > 1) entry.chunks.set(chunk, references - 1);
    else entry.chunks.delete(chunk);
    if (entry.chunks.size) return;
    this.lodQueue.delete(entry);
    this.lods.delete(geometry);
    for (const { geometry } of entry.levels) geometry.dispose();
  }

  private schedule() {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.runningLod && this.lodQueue.size) void this.prepareLods(this.epoch);
      const chunk = this.dirty.values().next().value;
      if (chunk) {
        this.dirty.delete(chunk);
        this.build(chunk);
      }
      if (this.dirty.size) this.schedule();
    }, 0);
  }

  private async prepareLods(epoch: number) {
    this.runningLod = true;
    const changed = new Set<Chunk>();
    while (this.lodQueue.size && epoch === this.epoch) {
      const entry = this.lodQueue.values().next().value!;
      this.lodQueue.delete(entry);
      const levels = await this.worker.prepare(entry.geometry);
      if (epoch !== this.epoch || this.lods.get(entry.geometry) !== entry) {
        for (const { geometry } of levels) geometry.dispose();
        continue;
      }
      entry.levels = levels;
      if (levels.length) for (const chunk of entry.chunks.keys()) changed.add(chunk);
    }
    if (epoch !== this.epoch) return;
    this.runningLod = false;
    for (const chunk of changed) if (chunk.items.size) this.dirty.add(chunk);
    if (this.dirty.size) this.schedule();
    this.invalidate();
  }

  private build(chunk: Chunk) {
    const sources = [...chunk.items.values()].flat();
    const previous = chunk.prepared;
    let prepared: PreparedChunk;
    try {
      prepared = buildPreparedChunk(
        sources,
        (geometry) => this.lods.get(geometry)?.levels ?? EMPTY_LODS,
        this.packer,
      );
    } catch {
      // A failed pack retains the existing ordinary or prepared output.
      return;
    }
    chunk.root.clear();
    if (previous) disposePreparedChunk(previous);
    chunk.prepared = prepared;
    chunk.root.add(prepared.root);
    selectPreparedChunkLod(prepared, this.pixelsPerUnit);
    this.buildCount++;
    // Prepared draws replace proxies with the same authored caster inputs.
    this.invalidate();
  }

  dispose() {
    ++this.epoch;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.runningLod = false;
    this.worker.dispose();
    for (const { prepared } of this.chunks.values()) {
      if (prepared) disposePreparedChunk(prepared);
    }
    for (const entry of this.lods.values()) {
      for (const { geometry } of entry.levels) geometry.dispose();
    }
    this.root.clear();
    this.chunks.clear();
    this.items.clear();
    this.dirty.clear();
    this.lodQueue.clear();
    this.lods.clear();
    this.packer.clear();
    this.meshCount = 0;
    this.buildCount = 0;
    this.pixelsPerUnit = Infinity;
    this.changed();
  }
}
