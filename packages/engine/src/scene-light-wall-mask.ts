import {
  Material,
  Mesh,
  Plane,
  PointLight,
  ShaderChunk,
  Vector4,
  type BufferGeometry,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { createContext } from "react";

export type SceneLightWallPlane = readonly [number, number, number, number];
export const SceneLightWallMaskContext = createContext<SceneLightWallMask | null>(null);

type Hooks = Pick<Material, "onBeforeCompile" | "onBeforeRender" | "customProgramCacheKey">;
type Patch = {
  original: Hooks;
  owners: Set<SceneLightWallMask>;
  uniform: { value: Vector4[] };
  onDispose: () => void;
};
const patches = new WeakMap<Material, Patch>();
const frames = new WeakMap<
  Scene,
  {
    renderer: WebGLRenderer;
    camera: Camera;
    frame: number;
    planes: Vector4[];
  }
>();

/** Batching still sees the authored hooks, not this engine-owned lighting patch. */
export const sceneLightMaterialHooks = (material: Material): Hooks =>
  patches.get(material)?.original ?? material;

function wallPlanes(renderer: WebGLRenderer, scene: Scene, camera: Camera): Vector4[] {
  const frame = renderer.info.render.frame;
  const cached = frames.get(scene);
  if (cached?.renderer === renderer && cached.camera === camera && cached.frame === frame)
    return cached.planes;
  const lights: PointLight[] = [];
  scene.traverseVisible((object) => {
    if (object instanceof PointLight && object.layers.test(camera.layers)) lights.push(object);
  });
  // Match Three's point-light uniform order, including any non-Cabane shadow lights.
  lights.sort((a, b) => Number(b.castShadow) - Number(a.castShadow));
  const plane = new Plane();
  const planes = lights.map((light) => {
    const wall = light.userData.cabaneLightWallPlane as SceneLightWallPlane | null | undefined;
    if (!wall) return new Vector4(0, 0, 0, 1);
    plane.normal.set(wall[0], wall[1], wall[2]);
    plane.constant = wall[3];
    if (light.parent) plane.applyMatrix4(light.parent.matrixWorld);
    plane.applyMatrix4(camera.matrixWorldInverse);
    return new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  });
  frames.set(scene, { renderer, camera, frame, planes });
  return planes;
}

const maskedLighting = ShaderChunk.lights_fragment_begin.replace(
  "getPointLightInfo( pointLight, geometryPosition, directLight );",
  `getPointLightInfo( pointLight, geometryPosition, directLight );
    directLight.color *= step(-0.001, dot(cabaneLightWallPlanes[ i ], vec4(geometryPosition, 1.0)));`,
);

/** Clip each source at its wall's inner face, retaining illumination around the bulb. */
export class SceneLightWallMask {
  private readonly materials = new Set<Material>();

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
      // Retain these methods for calls with their original receiver and exact restoration.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { onBeforeCompile, onBeforeRender, customProgramCacheKey } = material;
      patch = {
        original: { onBeforeCompile, onBeforeRender, customProgramCacheKey },
        owners: new Set(),
        uniform: { value: [] },
        onDispose: () => {},
      };
      const installed = patch;
      material.onBeforeRender = function (renderer, scene, camera, geometry, object, group) {
        onBeforeRender.call(this, renderer, scene, camera, geometry, object, group);
        // Shared imported materials can also render in another canvas or an unmasked preview.
        installed.uniform.value = wallPlanes(renderer, scene, camera);
      };
      material.onBeforeCompile = function (shader, renderer) {
        onBeforeCompile.call(this, shader, renderer);
        shader.uniforms.cabaneLightWallPlanes = installed.uniform;
        shader.fragmentShader = `#if NUM_POINT_LIGHTS > 0
          uniform vec4 cabaneLightWallPlanes[ NUM_POINT_LIGHTS ];
          #endif\n${shader.fragmentShader}`.replace(
          "#include <lights_fragment_begin>",
          maskedLighting,
        );
      };
      material.customProgramCacheKey = function () {
        const key =
          customProgramCacheKey === Material.prototype.customProgramCacheKey
            ? onBeforeCompile.toString()
            : customProgramCacheKey.call(this);
        return `${key}|cabane-light-wall-mask-v1`;
      };
      patches.set(material, installed);
      installed.onDispose = () => {
        for (const owner of installed.owners) owner.materials.delete(material);
        installed.owners.clear();
        material.removeEventListener("dispose", installed.onDispose);
        Object.assign(material, installed.original);
        material.needsUpdate = true;
        patches.delete(material);
      };
      material.addEventListener("dispose", installed.onDispose);
      material.needsUpdate = true;
    }
    patch.owners.add(this);
    this.materials.add(material);
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    scene.traverseVisible((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        this.prepareMaterial(material);
    });
    renderer.render(scene, camera);
  }

  dispose() {
    for (const material of this.materials) {
      const patch = patches.get(material);
      if (!patch) continue;
      patch.owners.delete(this);
      if (patch.owners.size) continue;
      material.removeEventListener("dispose", patch.onDispose);
      Object.assign(material, patch.original);
      material.needsUpdate = true;
      patches.delete(material);
    }
    this.materials.clear();
  }
}
