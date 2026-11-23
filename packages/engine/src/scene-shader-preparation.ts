import {
  BufferGeometry,
  Mesh,
  Scene,
  type Camera,
  type Material,
  type Texture,
  type WebGLRenderer,
} from "three";

type Program = NonNullable<WebGLRenderer["info"]["programs"]>[number];
type MapSlot = { name: string; texture: Texture | null; version: number };

/** Prepare the editor's actual material variants and full-resolution textures as they arrive. */
export class SceneShaderPreparation {
  private readonly materials = new WeakMap<Material, MapSlot[]>();
  private readonly initialized = new WeakSet<Program>();
  private readonly uploaded = new WeakMap<Texture, number>();
  private readonly programs = new Set<Program>();
  private readonly textures = new Set<Texture>();
  private changed = false;
  private preparedScreen = false;

  prepareScreen(renderer: WebGLRenderer, material: Material, camera: Camera) {
    if (this.preparedScreen) return;
    this.preparedScreen = true;
    if (!renderer.extensions.has("KHR_parallel_shader_compile")) return;
    // Compile the contour shader for the screen before submitting thousands of scene draws.
    const screen = new Scene();
    const surface = new Mesh(new BufferGeometry(), material);
    screen.add(surface);
    renderer.compile(screen, camera);
    surface.geometry.dispose();
  }

  observe = (material: Material) => {
    if (!material.visible) return;
    const properties = material as Material & Record<string, Texture | null>;
    let slots = this.materials.get(material);
    if (!slots) {
      slots = Object.keys(material)
        .filter((key) => key === "map" || key.endsWith("Map"))
        .map((name) => ({ name, texture: null, version: -1 }));
      this.materials.set(material, slots);
      this.changed = true;
    }
    for (const slot of slots) {
      const texture = properties[slot.name];
      const version = texture?.version ?? -1;
      if (slot.texture === texture && slot.version === version) continue;
      if (!!texture !== !!slot.texture) this.changed = true;
      slot.texture = texture;
      slot.version = version;
      if (
        texture?.isTexture &&
        !texture.isRenderTargetTexture &&
        texture.image &&
        this.uploaded.get(texture) !== version
      )
        this.textures.add(texture);
    }
  };

  ready(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    if (!this.changed && !this.textures.size && !this.programs.size) return true;
    const gl = renderer.getContext();
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    if (this.changed) {
      this.changed = false;
      if (parallel) {
        // Batch meshes and the final render target must be installed before compiling.
        renderer.compile(scene, camera);
        for (const program of renderer.info.programs ?? [])
          if (!this.initialized.has(program)) this.programs.add(program);
      }
    }
    const start = performance.now();
    for (const texture of this.textures) {
      renderer.initTexture(texture);
      this.textures.delete(texture);
      this.uploaded.set(texture, texture.version);
      if (performance.now() - start >= 5) return false;
    }
    for (const program of this.programs) {
      // Edits or navigation can dispose a program while it compiles.
      if (program.program && parallel) {
        if (
          !gl.getProgramParameter(program.program as WebGLProgram, parallel.COMPLETION_STATUS_KHR)
        )
          continue;
        // The first uniform reflection can itself block. Keep it in the same bounded slice.
        program.getUniforms();
      }
      this.initialized.add(program);
      this.programs.delete(program);
      if (performance.now() - start >= 5) return false;
    }
    return !this.programs.size;
  }
}
