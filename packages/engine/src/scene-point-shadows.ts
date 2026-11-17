import {
  DepthTexture,
  LessEqualCompare,
  Material,
  Mesh,
  PointLight,
  Sphere,
  Vector3,
  Vector4,
  VSMShadowMap,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { createContext } from "react";
import { PointShadowAtlas, pointShadowFar, pointShadowNear } from "./point-shadow-atlas";
import { addPointShadowSampling } from "./point-shadow-shader";
import { ShadowMapCache } from "./shadow-map-cache";

export const ScenePointShadowsContext = createContext<ScenePointShadows | null>(null);

type Hooks = Pick<Material, "onBeforeCompile" | "onBeforeRender" | "customProgramCacheKey">;
type ShadowUniforms = {
  atlas: { value: DepthTexture };
  faceSize: { value: number };
  points: { value: Vector4[] };
  pointCount: { value: number };
};
type Patch = {
  original: Hooks;
  owners: Set<ScenePointShadows>;
  onDispose: () => void;
};
const patches = new WeakMap<Material, Patch>();
const owners = new WeakMap<Scene, ScenePointShadows>();

// A comparison sampler requires a compatible texture even in scenes without
// any Cabane lamps, such as a preview sharing an imported material.
const emptyAtlas = new DepthTexture(1, 1);
emptyAtlas.compareFunction = LessEqualCompare;
emptyAtlas.needsUpdate = true;
const emptyUniforms: ShadowUniforms = {
  atlas: { value: emptyAtlas },
  faceSize: { value: 1 },
  points: { value: [] },
  pointCount: { value: 0 },
};

/** Batching and the solar shadow cache inspect the authored material hooks. */
export const sceneLightMaterialHooks = (material: Material): Hooks =>
  patches.get(material)?.original ?? material;

type Blocker = { inputs: ShadowMapCache; bounds: Sphere | undefined };
type Slot = {
  index: number;
  origin: Vector3;
  far: number;
  dirty: boolean;
  ready: boolean;
  updated: number;
};

const noShadow = new Vector4(-1, 0, 0, 0);
const pendingShadow = new Vector4(-2, 0, 0, 0);
const geometryOrigin = new Vector3();

function pointUniforms(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
  const owner = owners.get(scene);
  if (owner) return owner.uniformsFor(renderer, camera);
  let count = 0;
  scene.traverseVisible((object) => {
    if (object instanceof PointLight && object.layers.test(camera.layers)) count++;
  });
  while (emptyUniforms.points.value.length < count) emptyUniforms.points.value.push(noShadow);
  emptyUniforms.pointCount.value = count;
  return emptyUniforms;
}

function reaches(light: PointLight, bounds: Sphere | undefined) {
  if (!bounds || !light.distance) return true;
  const limit = light.distance + bounds.radius;
  return (
    geometryOrigin.setFromMatrixPosition(light.matrixWorld).distanceToSquared(bounds.center) <=
    limit * limit
  );
}

/** Native depth draws are scheduled separately from the single beauty pass. */
export class ScenePointShadows {
  private readonly materials = new Set<Material>();
  private readonly uniforms: ShadowUniforms = {
    atlas: { value: emptyAtlas },
    faceSize: { value: 1 },
    points: { value: [] },
    pointCount: { value: 0 },
  };
  private readonly entries: Vector4[] = [];
  private readonly position = new Vector3();
  private readonly previousBounds = new Sphere();
  private blockers = new Map<Mesh, Blocker>();
  private slots = new Map<PointLight, Slot>();
  private atlas: PointShadowAtlas | undefined;
  private scene: Scene | undefined;
  private frame = -1;
  private captureCount = 0;
  private camera: Camera | undefined;
  private lightOrder: PointLight[] = [];

  prepareMaterial(material: Material) {
    if (this.materials.has(material)) return;
    if (
      !("isMeshToonMaterial" in material) &&
      !("isMeshStandardMaterial" in material) &&
      !("isMeshLambertMaterial" in material) &&
      !("isMeshPhongMaterial" in material)
    )
      return;
    let patch = patches.get(material);
    if (!patch) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { onBeforeCompile, onBeforeRender, customProgramCacheKey } = material;
      const uniforms = {
        atlas: { value: emptyAtlas },
        faceSize: { value: 1 },
        points: { value: [] as Vector4[] },
        pointCount: { value: 0 },
      };
      material.onBeforeRender = function (renderer, scene, camera, geometry, object, group) {
        onBeforeRender.call(this, renderer, scene, camera, geometry, object, group);
        const current = pointUniforms(scene, camera, renderer);
        uniforms.atlas.value = current.atlas.value;
        uniforms.faceSize.value = current.faceSize.value;
        uniforms.points.value = current.points.value;
        uniforms.pointCount.value = current.pointCount.value;
      };
      material.onBeforeCompile = function (shader, renderer) {
        onBeforeCompile.call(this, shader, renderer);
        shader.uniforms.cabaneShadowAtlas = uniforms.atlas;
        shader.uniforms.cabaneShadowFaceSize = uniforms.faceSize;
        shader.uniforms.cabanePointShadows = uniforms.points;
        shader.uniforms.cabanePointLightCount = uniforms.pointCount;
        shader.fragmentShader = addPointShadowSampling(shader.fragmentShader);
      };
      material.customProgramCacheKey = function () {
        const key =
          customProgramCacheKey === Material.prototype.customProgramCacheKey
            ? onBeforeCompile.toString()
            : customProgramCacheKey.call(this);
        return `${key}|cabane-point-shadows`;
      };
      const installed: Patch = {
        original: { onBeforeCompile, onBeforeRender, customProgramCacheKey },
        owners: new Set(),
        onDispose: () => {
          for (const owner of installed.owners) owner.materials.delete(material);
          installed.owners.clear();
          material.removeEventListener("dispose", installed.onDispose);
          Object.assign(material, installed.original);
          material.needsUpdate = true;
          patches.delete(material);
        },
      };
      patch = installed;
      patches.set(material, installed);
      material.addEventListener("dispose", installed.onDispose);
      material.needsUpdate = true;
    }
    patch.owners.add(this);
    this.materials.add(material);
  }

  uniformsFor(renderer: WebGLRenderer, camera: Camera) {
    if (this.camera === camera && this.frame === renderer.info.render.frame) return this.uniforms;
    this.frame = renderer.info.render.frame;
    this.camera = camera;
    const points = this.uniforms.points.value;
    let index = 0;
    for (const light of this.lightOrder) {
      if (!light.layers.test(camera.layers)) continue;
      const slot = this.slots.get(light);
      const atlas = this.atlas;
      const entry = this.entries[index] ?? (this.entries[index] = new Vector4());
      if (atlas && slot?.ready) {
        entry.set(
          atlas.column(slot.index),
          atlas.row(slot.index),
          pointShadowNear(slot.far),
          slot.far,
        );
        points[index++] = entry;
      } else {
        points[index++] = atlas && slot ? pendingShadow : noShadow;
      }
    }
    points.length = index;
    this.uniforms.pointCount.value = index;
    return this.uniforms;
  }

  update(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    if (this.scene !== scene) {
      this.scene = scene;
      owners.set(scene, this);
    }
    this.frame = -1;
    const household: PointLight[] = [];
    const casters: Mesh[] = [];
    const ordered: PointLight[] = [];
    const enabled = renderer.shadowMap.enabled && renderer.shadowMap.type !== VSMShadowMap;
    if (enabled && scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    scene.traverseVisible((object) => {
      if (object instanceof PointLight) {
        ordered.push(object);
        if (object.userData.cabaneSceneLight && object.layers.test(camera.layers))
          household.push(object);
      }
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        this.prepareMaterial(material);
      if (enabled && mesh.castShadow && mesh.layers.test(camera.layers)) casters.push(mesh);
    });
    // Same ordering as the native WebGL light uniforms, for any non-household shadow.
    this.lightOrder = ordered.sort((a, b) => Number(b.castShadow) - Number(a.castShadow));
    if (!enabled || !household.length) {
      if (this.atlas) this.reset();
      return false;
    }
    if (!this.atlas || this.atlas.capacity < household.length) {
      this.reset();
      this.atlas = new PointShadowAtlas(household.length, renderer.capabilities.maxTextureSize);
      renderer.initRenderTarget(this.atlas.target);
      this.uniforms.atlas.value = this.atlas.target.depthTexture!;
      this.uniforms.faceSize.value = this.atlas.faceSize;
    }
    const atlas = this.atlas;
    const live = new Set(household);
    for (const light of this.slots.keys()) if (!live.has(light)) this.slots.delete(light);
    const used = new Set(Array.from(this.slots.values(), ({ index }) => index));
    let available = 0;
    for (const light of household) {
      const slot = this.slots.get(light);
      this.position.setFromMatrixPosition(light.matrixWorld);
      const far = pointShadowFar(light);
      if (!slot) {
        while (used.has(available)) available++;
        this.slots.set(light, {
          index: available++,
          origin: this.position.clone(),
          far,
          dirty: true,
          ready: false,
          updated: 0,
        });
      } else if (!slot.origin.equals(this.position) || slot.far !== far) {
        slot.origin.copy(this.position);
        slot.far = far;
        slot.dirty = true;
        slot.ready = false;
      }
    }

    const invalidateBlocker = (bounds: Sphere | undefined, previous?: Sphere) => {
      for (const light of household) {
        const slot = this.slots.get(light)!;
        if (slot.ready && (reaches(light, bounds) || (previous && reaches(light, previous))))
          slot.dirty = true;
      }
    };
    const present = new Set(casters);
    for (const [mesh, blocker] of this.blockers) {
      if (present.has(mesh)) continue;
      this.blockers.delete(mesh);
      invalidateBlocker(blocker.bounds);
    }
    const dynamic: Array<Sphere | undefined> = [];
    for (const mesh of casters) {
      let blocker = this.blockers.get(mesh);
      if (!blocker) {
        blocker = { inputs: new ShadowMapCache(), bounds: undefined };
        this.blockers.set(mesh, blocker);
      }
      const changed = blocker.inputs.needsUpdate(scene, camera, renderer.shadowMap.type, mesh);
      if (!changed) {
        if (blocker.inputs.dynamic) dynamic.push(blocker.bounds);
        continue;
      }
      const previous = blocker.bounds && this.previousBounds.copy(blocker.bounds);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const rigid =
        mesh.type === "Mesh" &&
        !mesh.customDepthMaterial &&
        !mesh.customDistanceMaterial &&
        !mesh.morphTargetInfluences?.length &&
        !materials.some(
          (material) => (material as Material & { displacementMap?: unknown }).displacementMap,
        );
      if (rigid) {
        // The cache catches both in-place and replacement geometry edits.
        mesh.geometry.computeBoundingSphere();
        blocker.bounds = (blocker.bounds ?? new Sphere())
          .copy(mesh.geometry.boundingSphere!)
          .applyMatrix4(mesh.matrixWorld);
      } else blocker.bounds = undefined;
      invalidateBlocker(blocker.bounds, previous);
    }

    // Warm powered lamps first. A moving blocker can dirty several slots at
    // once, so prefer the oldest map and give every newly powered source a turn.
    const dirty = household.filter((light) => {
      const slot = this.slots.get(light)!;
      return slot.dirty && (light.intensity > 0 || !slot.ready);
    });
    const older = (left: PointLight, right: PointLight) =>
      this.slots.get(left)!.updated - this.slots.get(right)!.updated;
    dirty.sort((a, b) => Number(b.intensity > 0) - Number(a.intensity > 0) || older(a, b));
    const next =
      dirty[0] ??
      household
        .filter((light) => light.intensity > 0 && dynamic.some((bounds) => reaches(light, bounds)))
        .sort(older)[0];
    if (next) {
      const slot = this.slots.get(next)!;
      const blockers = casters.filter((mesh) => reaches(next, this.blockers.get(mesh)?.bounds));
      if (atlas.capture(renderer, camera, next, slot.index, blockers)) {
        slot.ready = true;
        slot.dirty = false;
        slot.updated = ++this.captureCount;
      }
    }
    return dirty.length > 1;
  }

  reset = () => {
    this.atlas?.dispose();
    this.atlas = undefined;
    this.blockers.clear();
    this.slots.clear();
    this.uniforms.atlas.value = emptyAtlas;
    this.frame = -1;
  };

  dispose() {
    this.reset();
    if (this.scene && owners.get(this.scene) === this) owners.delete(this.scene);
    this.scene = undefined;
    for (const material of this.materials) {
      const patch = patches.get(material);
      if (!patch) continue;
      patch.owners.delete(this);
      if (!patch.owners.size) patch.onDispose();
    }
    this.materials.clear();
  }
}
