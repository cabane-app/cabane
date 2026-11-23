import type { Camera, Material, Object3D, Scene, WebGLRenderer } from "three";

type Drawable = Object3D & {
  isMesh?: boolean;
  isBatchedMesh?: boolean;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
  material?: Material | Material[];
};

/**
 * Keeps shader compilation off the frame that first needs a program.
 *
 * Three.js compiles a program synchronously during the first draw that uses it. With many
 * scene lights each program is large, and a populated home can stall the page (and the
 * GPU process) for seconds. When a frame would need a program that has not been prepared
 * yet, this starts compiling in parallel instead of drawing and keeps the previous frame on screen.
 * The frame is drawn once the driver reports the programs ready (KHR_parallel_shader_compile).
 * Without the extension the frame draws as before.
 * Materials are tracked by identity and draw variant; later edits to a prepared material
 * compile during drawing as before.
 */
export class SceneShaderWarmup {
  private prepared = new WeakMap<Material, Set<number>>();
  private lightKey = "";
  private pending: object | null = null;
  private disposed = false;

  /** True while programs for the latest scene compile; the previous frame stays visible. */
  get waiting() {
    return this.pending !== null;
  }

  /**
   * Draw when every visible material has a prepared program. Otherwise start preparing and
   * call `onReady` when drawing will no longer stall. Returns whether `draw` ran.
   */
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    draw: () => void,
    onReady: () => void,
  ) {
    if (this.pending) return false;
    // A lost context cannot report compile status; draw so the caller sees the loss.
    if (renderer.getContext().isContextLost()) {
      draw();
      return true;
    }
    // Without the extension a status check blocks anyway, so ordinary drawing is no worse.
    if (!this.needsPrograms(scene) || !renderer.extensions.has("KHR_parallel_shader_compile")) {
      draw();
      return true;
    }
    // Like compileAsync, but a material disposed while compiling (a rebuilt batch) counts as
    // done instead of leaving the wait unresolved.
    const materials = renderer.compile(scene, camera);
    const token = {};
    const settled = () => {
      if (renderer.getContext().isContextLost()) return true;
      for (const material of materials) {
        const program = (
          renderer.properties.get(material) as { currentProgram?: { isReady(): boolean } }
        ).currentProgram;
        if (!program || program.isReady()) materials.delete(material);
      }
      return materials.size === 0;
    };
    if (settled()) {
      draw();
      return true;
    }
    const poll = () => {
      if (this.pending !== token) return;
      if (!settled()) {
        setTimeout(poll, 10);
        return;
      }
      this.pending = null;
      if (!this.disposed) onReady();
    };
    this.pending = token;
    setTimeout(poll, 10);
    return false;
  }

  /** Forget prepared programs, e.g. after a lost context is restored. */
  reset() {
    this.prepared = new WeakMap();
    this.lightKey = "";
    this.pending = null;
  }

  dispose() {
    this.disposed = true;
    this.pending = null;
  }

  /** Record visible materials and the light layout; report whether anything is new. */
  private needsPrograms(scene: Scene) {
    let point = 0,
      spot = 0,
      directional = 0,
      hemisphere = 0,
      rect = 0,
      shadows = 0;
    let unseen = false;
    const visit = (material: Material, variant: number) => {
      let keys = this.prepared.get(material);
      if (!keys) this.prepared.set(material, (keys = new Set()));
      if (keys.has(variant)) return;
      keys.add(variant);
      unseen = true;
    };
    scene.traverseVisible((object) => {
      const light = object as Object3D & {
        isLight?: boolean;
        isPointLight?: boolean;
        isSpotLight?: boolean;
        isDirectionalLight?: boolean;
        isHemisphereLight?: boolean;
        isRectAreaLight?: boolean;
        castShadow: boolean;
      };
      if (light.isLight) {
        if (light.isPointLight) point++;
        else if (light.isSpotLight) spot++;
        else if (light.isDirectionalLight) directional++;
        else if (light.isHemisphereLight) hemisphere++;
        else if (light.isRectAreaLight) rect++;
        if (light.castShadow) shadows++;
        return;
      }
      const mesh = object as Drawable;
      if (!mesh.isMesh || !mesh.material) return;
      const variant =
        (mesh.isBatchedMesh ? 1 : 0) |
        (mesh.isInstancedMesh ? 2 : 0) |
        (mesh.isSkinnedMesh ? 4 : 0);
      if (Array.isArray(mesh.material))
        for (const material of mesh.material) visit(material, variant);
      else visit(mesh.material, variant);
    });
    // Light counts are compiled into every lit program, so a new layout needs new programs.
    const lightKey = `${point}/${spot}/${directional}/${hemisphere}/${rect}/${shadows}`;
    if (lightKey !== this.lightKey) {
      const first = this.lightKey === "";
      this.lightKey = lightKey;
      if (!first) {
        // Every program is stale: forget them and record the visible set again.
        this.prepared = new WeakMap();
        this.needsPrograms(scene);
        return true;
      }
    }
    return unseen;
  }
}
