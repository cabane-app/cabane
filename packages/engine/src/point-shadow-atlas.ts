import {
  DepthTexture,
  LessEqualCompare,
  LinearFilter,
  OrthographicCamera,
  PointLight,
  RedFormat,
  Scene,
  UnsignedIntType,
  WebGLRenderTarget,
  type Camera,
  type Mesh,
  type WebGLRenderer,
  WebGLCubeRenderTarget,
} from "three";

export const pointShadowFar = (light: PointLight) => light.distance || 500;
export const pointShadowNear = (far: number) => Math.min(0.01, far / 2);

/** One reusable native cube supplies the depth for every lamp's six atlas tiles. */
export class PointShadowAtlas {
  readonly target: WebGLRenderTarget;
  readonly faceSize: number;
  private readonly columns: number;
  private readonly scratch = new WebGLRenderTarget(1, 1);
  private readonly light = new PointLight();
  private readonly scene = new Scene();
  private readonly view = new OrthographicCamera(-0.1, 0.1, 0.1, -0.1, 0.01, 1);

  constructor(
    readonly capacity: number,
    maxTextureSize: number,
  ) {
    this.columns = Math.ceil(Math.sqrt((2 * capacity) / 3));
    const rows = Math.ceil(capacity / this.columns);
    this.faceSize = Math.min(
      capacity <= 16 ? 256 : 128,
      Math.floor(maxTextureSize / Math.max(this.columns * 3, rows * 2)),
    );
    const width = this.columns * 3 * this.faceSize;
    const height = rows * 2 * this.faceSize;
    const depth = new DepthTexture(width, height, UnsignedIntType);
    depth.compareFunction = LessEqualCompare;
    depth.minFilter = depth.magFilter = LinearFilter;
    depth.name = "cabane-household-shadow-atlas";
    this.target = new WebGLRenderTarget(width, height, { format: RedFormat, depthTexture: depth });
    this.light.castShadow = true;
    this.light.shadow.autoUpdate = false;
    this.light.shadow.mapSize.setScalar(this.faceSize);
    this.view.position.y = 1_000_000;
    // Native shadow rendering reads the actual casters' already updated world matrices.
    this.scene.matrixWorldAutoUpdate = false;
  }

  column(slot: number) {
    return (slot % this.columns) * 3;
  }

  row(slot: number) {
    return Math.floor(slot / this.columns) * 2;
  }

  capture(
    renderer: WebGLRenderer,
    camera: Camera,
    light: PointLight,
    slot: number,
    casters: Mesh[],
  ) {
    const native = this.light;
    native.matrixWorld.copy(light.matrixWorld);
    native.distance = light.distance;
    native.shadow.camera.far = pointShadowFar(light);
    native.shadow.camera.near = pointShadowNear(native.shadow.camera.far);
    native.shadow.camera.updateProjectionMatrix();
    native.shadow.needsUpdate = true;
    this.view.layers.mask = camera.layers.mask;
    this.scene.children = [native, ...casters];
    // The virtual scene is flat. Retain each real caster's native material,
    // skinning, instancing and depth hooks without traversing its children twice.
    const children = casters.map((caster) => caster.children);
    const previous = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const mip = renderer.getActiveMipmapLevel();
    const shadows = renderer.shadowMap;
    const { needsUpdate, autoUpdate } = shadows;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const readFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    try {
      for (const caster of casters) if (caster.children.length) caster.children = [];
      shadows.autoUpdate = false;
      shadows.needsUpdate = true;
      renderer.setRenderTarget(this.scratch);
      renderer.render(this.scene, this.view);
      const cube = native.shadow.map;
      if (!(cube instanceof WebGLCubeRenderTarget)) return false;
      const size = this.faceSize;
      for (let side = 0; side < 6; side++) {
        renderer.setRenderTarget(cube, side);
        const source = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer;
        renderer.setRenderTarget(this.target);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
        const x = (this.column(slot) + (side % 3)) * size;
        const y = (this.row(slot) + Math.floor(side / 3)) * size;
        gl.blitFramebuffer(
          0,
          0,
          size,
          size,
          x,
          y,
          x + size,
          y + size,
          gl.DEPTH_BUFFER_BIT,
          gl.NEAREST,
        );
      }
      return true;
    } finally {
      casters.forEach((caster, index) => (caster.children = children[index]));
      this.scene.children = [];
      shadows.autoUpdate = autoUpdate;
      shadows.needsUpdate = needsUpdate;
      // READ and DRAW bindings can differ after the blit, even if the renderer
      // thinks it is still on the same render target.
      renderer.setRenderTarget(previous, face, mip);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFramebuffer);
    }
  }

  dispose() {
    this.light.shadow.dispose();
    this.scratch.dispose();
    this.target.dispose();
  }
}
