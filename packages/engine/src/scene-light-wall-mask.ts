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
    pointLightLimit: number;
  }
>();

/** Batching still sees the authored hooks, not this engine-owned lighting patch. */
export const sceneLightMaterialHooks = (material: Material): Hooks =>
  patches.get(material)?.original ?? material;

function lightsForFrame(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const frame = renderer.info.render.frame;
  const cached = frames.get(scene);
  if (cached?.renderer === renderer && cached.camera === camera && cached.frame === frame)
    return cached;
  const lights: PointLight[] = [];
  scene.traverseVisible((object) => {
    if (object instanceof PointLight && object.layers.test(camera.layers)) lights.push(object);
  });
  // Match Three's point-light uniform order, including any non-Cabane shadow lights.
  lights.sort((a, b) => Number(b.castShadow) - Number(a.castShadow));
  const plane = new Plane();
  let pointLightLimit = 0;
  const planes = lights.map((light, index) => {
    if (light.intensity !== 0) pointLightLimit = index + 1;
    const wall = light.userData.cabaneLightWallPlane as SceneLightWallPlane | null | undefined;
    if (!wall) return new Vector4(0, 0, 0, 1);
    plane.normal.set(wall[0], wall[1], wall[2]);
    plane.constant = wall[3];
    if (light.parent) plane.applyMatrix4(light.parent.matrixWorld);
    plane.applyMatrix4(camera.matrixWorldInverse);
    return new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  });
  const snapshot = { renderer, camera, frame, planes, pointLightLimit };
  frames.set(scene, snapshot);
  return snapshot;
}

const pointLightInfo = "getPointLightInfo( pointLight, geometryPosition, directLight );";
const directLightContribution =
  "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
// Keep the existing shader layout on light toggles. Outside a lamp’s cutoff
// or behind its wall the direct contribution is exactly zero; skip its BRDF.
const maskedLighting = ShaderChunk.lights_fragment_begin
  .replace(
    pointLightInfo,
    `{ vec3 toLamp = pointLight.position - geometryPosition;
     if (pointLight.color != vec3(0.0) &&
         (pointLight.distance <= 0.0 || dot(toLamp,toLamp) < pointLight.distance * pointLight.distance) &&
         dot(cabaneLightWallPlanes[ i ], vec4(geometryPosition, 1.0)) >= -0.001) {
       ${pointLightInfo}`,
  )
  .replace(directLightContribution, `${directLightContribution}\n    } }`);

// The editor has no shadow maps. Keep the same point-light shading and uniforms,
// but compile its body once even when dozens of idle lamps reserve shader slots.
const loopedLighting = maskedLighting.replace(
  /#pragma unroll_loop_start(\s+for \( int i = 0; i < NUM_POINT_LIGHTS;[\s\S]*?)#pragma unroll_loop_end/,
  (_, loop: string) => loop.replace("i < NUM_POINT_LIGHTS", "i < cabanePointLightLimit"),
);

// Uniforms live on the linked WebGL program. Three uploads plain vec4 arrays
// again on every material switch. Share the snapshot across materials using
// that program, including when a mesh selects a different shader variant.
const uploadedPlanes = new WeakMap<object, Vector4[]>();

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
        onDispose: () => {},
      };
      const installed = patch;
      let planes: Vector4[] = [];
      const pointLightLimit = { value: 0 };
      let properties: { currentProgram?: object } | undefined;
      const uniform = {
        get needsUpdate() {
          const program = properties?.currentProgram;
          return !program || uploadedPlanes.get(program) !== planes;
        },
        get value() {
          const program = properties?.currentProgram;
          if (program) uploadedPlanes.set(program, planes);
          return planes;
        },
      };
      material.onBeforeRender = function (renderer, scene, camera, geometry, object, group) {
        onBeforeRender.call(this, renderer, scene, camera, geometry, object, group);
        // Shared imported materials can also render in another canvas or an unmasked preview.
        const frame = lightsForFrame(renderer, scene, camera);
        planes = frame.planes;
        pointLightLimit.value = frame.pointLightLimit;
        // Read currentProgram lazily in the upload above. Three selects it
        // after onBeforeRender and before WebGLUniforms.upload.
        properties = renderer.properties?.get(this) as typeof properties;
      };
      material.onBeforeCompile = function (shader, renderer) {
        onBeforeCompile.call(this, shader, renderer);
        shader.uniforms.cabaneLightWallPlanes = uniform;
        const useLoop = !shader.shadowMapEnabled && shader.numPointLights > 8;
        if (useLoop) shader.uniforms.cabanePointLightLimit = pointLightLimit;
        shader.fragmentShader = `#if NUM_POINT_LIGHTS > 0
          uniform vec4 cabaneLightWallPlanes[ NUM_POINT_LIGHTS ];
          ${useLoop ? "uniform int cabanePointLightLimit;" : ""}
          #endif\n${shader.fragmentShader}`.replace(
          "#include <lights_fragment_begin>",
          useLoop ? loopedLighting : maskedLighting,
        );
      };
      material.customProgramCacheKey = function () {
        const key =
          customProgramCacheKey === Material.prototype.customProgramCacheKey
            ? onBeforeCompile.toString()
            : customProgramCacheKey.call(this);
        return `${key}|cabane-light-wall-mask-v4`;
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

  prepare(scene: Scene, observe?: (material: Material) => void) {
    scene.traverseVisible((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        this.prepareMaterial(material);
        observe?.(material);
      }
    });
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    this.prepare(scene);
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
