import {
  Material,
  Mesh,
  Object3D,
  VSMShadowMap,
  type BufferAttribute,
  type Camera,
  type DirectionalLight,
  type Light,
  type LightShadow,
  type MeshToonMaterial,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { sceneLightMaterialHooks } from "./scene-point-shadows";

const positionAttribute = ["position"];

function hasUpdatingShadowLight(object: Object3D, camera: Camera): boolean {
  if (!object.visible) return false;
  if ((object as Light).isLight && object.castShadow && object.layers.test(camera.layers)) {
    const shadow = (object as Light & { shadow?: LightShadow }).shadow;
    if (!shadow || shadow.autoUpdate || shadow.needsUpdate) return true;
  }
  for (const child of object.children) if (hasUpdatingShadowLight(child, camera)) return true;
  return false;
}

/** Compare render inputs without allocating a scene-sized signature every frame. */
class ShadowInputs {
  private values: unknown[] = [];
  private index = 0;
  changed = false;
  begin() {
    this.index = 0;
    this.changed = false;
  }
  add(value: unknown) {
    if (this.values[this.index] !== value) {
      this.values[this.index] = value;
      this.changed = true;
    }
    this.index++;
  }
  numbers(values: ArrayLike<number>) {
    for (let i = 0; i < values.length; i++) this.add(values[i]);
  }
  end() {
    if (this.values.length !== this.index) {
      this.values.length = this.index;
      this.changed = true;
    }
    return this.changed;
  }
  clear() {
    this.values.length = 0;
  }
}

/** Whole-map reuse only. Unknown shader/deformation hooks always redraw. */
export class ShadowMapCache {
  private inputs = new ShadowInputs();
  dynamic = false;
  reset = () => this.inputs.clear();

  needsUpdate(scene: Scene, camera: Camera, shadowType: number, caster?: Mesh) {
    const s = this.inputs;
    s.begin();
    s.add(shadowType);
    s.add(camera.layers.mask);
    let untracked = false;
    const texture = (t: Texture | null | undefined) => {
      s.add(t);
      if (!t) return;
      if (t.matrixAutoUpdate) t.updateMatrix();
      s.add(t.version);
      s.add(t.channel);
      s.add(t.wrapS);
      s.add(t.wrapT);
      s.numbers(t.matrix.elements);
      // Video and user-updated texture contents may change without a version bump.
      if ("isVideoTexture" in t && t.isVideoTexture) untracked = true;
    };
    const inspect = (object: Object3D) => {
      if (!caster && object.onBeforeRender !== Object3D.prototype.onBeforeRender) untracked = true;
      if ((object as DirectionalLight).isLight && (object as DirectionalLight).castShadow) {
        const light = object as DirectionalLight;
        s.add(light);
        s.numbers(light.matrixWorld.elements);
        s.add(light.layers.mask);
        if (!light.isDirectionalLight) {
          untracked = true;
          return;
        }
        light.target.updateWorldMatrix(true, false);
        s.numbers(light.target.matrixWorld.elements);
        const shadow = light.shadow;
        s.add(shadow);
        s.add(shadow.autoUpdate);
        s.add(shadow.map);
        s.add(shadow.mapSize.x);
        s.add(shadow.mapSize.y);
        s.numbers(shadow.camera.projectionMatrix.elements);
        s.add(shadow.camera.near);
        s.add(shadow.camera.far);
        s.add(shadow.bias);
        s.add(shadow.normalBias);
        s.add(shadow.radius);
        s.add(shadow.blurSamples);
        if (shadow.needsUpdate) untracked = true;
      }
      const mesh = object as Mesh;
      if (!mesh.castShadow || !mesh.layers.test(camera.layers)) return;
      if (!mesh.isMesh) {
        if ("geometry" in object) untracked = true;
        return;
      }
      s.add(mesh);
      s.numbers(mesh.matrixWorld.elements);
      s.add(mesh.layers.mask);
      s.add(mesh.frustumCulled);
      if (
        mesh.onBeforeShadow !== Object3D.prototype.onBeforeShadow ||
        mesh.onAfterShadow !== Object3D.prototype.onAfterShadow ||
        (!caster && mesh.onBeforeRender !== Object3D.prototype.onBeforeRender) ||
        mesh.customDepthMaterial ||
        mesh.customDistanceMaterial ||
        (mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh ||
        (mesh as Mesh & { isBatchedMesh?: boolean }).isBatchedMesh ||
        mesh.morphTargetInfluences?.some((weight) => weight !== 0)
      )
        untracked = true;
      const instances = mesh as Mesh & { instanceMatrix?: BufferAttribute; count?: number };
      s.add(instances.instanceMatrix);
      s.add(instances.instanceMatrix?.version);
      s.add(instances.count);
      const geometry = mesh.geometry;
      s.add(geometry);
      s.add(geometry.index);
      s.add(geometry.index?.version);
      s.add(geometry.drawRange.start);
      s.add(geometry.drawRange.count);
      const toon = mesh.material as MeshToonMaterial;
      // A single toon material without alpha clipping or displacement only
      // needs positions and indices for its silhouette.
      const simpleDepth =
        !Array.isArray(mesh.material) &&
        toon.isMeshToonMaterial &&
        !(toon.alphaTest > 0) &&
        !toon.alphaHash &&
        !toon.alphaToCoverage &&
        !toon.displacementMap;
      for (const name of simpleDepth ? positionAttribute : Object.keys(geometry.attributes)) {
        const a = geometry.attributes[name];
        s.add(name);
        s.add(a);
        s.add(a && ("data" in a ? a.data.version : a.version));
      }
      if (!simpleDepth) {
        for (const group of geometry.groups) {
          s.add(group.start);
          s.add(group.count);
          s.add(group.materialIndex);
        }
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        // Track depth inputs, not material.version: visual-only fade/shader updates
        // can bump that counter even when the final shadow inputs are unchanged.
        s.add(material);
        s.add(material.visible);
        s.add(material.side);
        s.add(material.shadowSide);
        s.add(material.alphaTest);
        s.add(material.alphaHash);
        s.add(material.alphaToCoverage);
        s.add(material.clipShadows);
        s.add(material.clipIntersection);
        for (const plane of material.clippingPlanes ?? []) {
          s.add(plane.normal.x);
          s.add(plane.normal.y);
          s.add(plane.normal.z);
          s.add(plane.constant);
        }
        const m = material as Material & {
          isMeshToonMaterial?: boolean;
          wireframe?: boolean;
          wireframeLinewidth?: number;
          map?: Texture;
          alphaMap?: Texture;
          displacementMap?: Texture;
          displacementScale?: number;
          displacementBias?: number;
        };
        s.add(m.wireframe);
        s.add(m.wireframeLinewidth);
        if (
          !caster &&
          (!m.isMeshToonMaterial ||
            sceneLightMaterialHooks(m).onBeforeCompile !== Material.prototype.onBeforeCompile)
        )
          untracked = true;
        if (material.alphaTest > 0 || material.alphaHash || material.alphaToCoverage) {
          texture(m.map);
          texture(m.alphaMap);
          s.add(material.opacity);
        }
        texture(m.displacementMap);
        s.add(m.displacementScale);
        s.add(m.displacementBias);
      }
    };
    if (caster) inspect(caster);
    else scene.traverseVisible(inspect);
    const changed = s.end();
    this.dynamic = untracked;
    // Local caster inputs are compared even for skinned meshes. Their owning
    // atlas can refresh dynamic shadows without keeping a demand canvas awake.
    if (caster) return changed;
    // A custom pass may have produced different depth: refresh once when returning
    // to the tracked path, even if all tracked values happen to match again.
    if (untracked) {
      s.clear();
      return true;
    }
    return changed;
  }

  /** Called after animation callbacks, with world matrices current. */
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    draw = () => renderer.render(scene, camera),
  ) {
    if (
      !renderer.shadowMap.enabled ||
      !renderer.shadowMap.autoUpdate ||
      renderer.shadowMap.type === VSMShadowMap ||
      renderer.localClippingEnabled ||
      renderer.clippingPlanes.length
    ) {
      this.reset();
      draw();
      return;
    }
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    const track = hasUpdatingShadowLight(scene, camera);
    const update = track && this.needsUpdate(scene, camera, renderer.shadowMap.type);
    if (!track) this.reset();
    const autoUpdate = scene.matrixWorldAutoUpdate;
    try {
      scene.matrixWorldAutoUpdate = false; // The same update already ran above.
      // Leave native updates enabled when no map currently needs tracking. A
      // render hook can still activate a light during the draw.
      if (track) {
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate ||= update;
      }
      draw();
    } catch (error) {
      this.reset();
      throw error;
    } finally {
      if (track) renderer.shadowMap.autoUpdate = true;
      scene.matrixWorldAutoUpdate = autoUpdate;
    }
  }
}
