import { useGraphicsFeature } from "./graphics-features";
import { DashboardRenderFailureContext } from "./DashboardSceneReady";
import { SceneEnvironment } from "./SceneEnvironment";
import { SceneStyleContext, useSceneStyle } from "./scene-style";
import { ImportedContourMask } from "./imported-models/contour-mask";
import { contourFragmentShader } from "./scene-contour-shader";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  DepthTexture,
  HalfFloatType,
  NearestFilter,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShadowMapCache } from "./shadow-map-cache";
import { SceneGeometryLod } from "./scene-batching/SceneGeometryLod";
import { SceneToonBatcher } from "./scene-batching/SceneToonBatcher";
import { SceneLightWallMask, SceneLightWallMaskContext } from "./scene-light-wall-mask";
import { SceneShaderWarmup } from "./scene-shader-warmup";

/** Decorative mesh shells are replaced by a single visible-depth contour pass. */
export const SceneContourContext = createContext(false);

function SceneContourPass({
  antialias,
  active,
  onFirstFrame,
}: {
  antialias: boolean;
  active: boolean;
  onFirstFrame?: (() => void) | null | undefined;
}) {
  const presented = useRef(false);
  const style = useSceneStyle();
  const detailedFinishes = useGraphicsFeature("finishes");
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const lightWalls = useContext(SceneLightWallMaskContext)!;
  const onRenderFailure = useContext(DashboardRenderFailureContext);
  const resources = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthTexture: new DepthTexture(1, 1),
      samples: antialias ? 4 : 0,
    });
    target.depthTexture!.minFilter = NearestFilter;
    target.depthTexture!.magFilter = NearestFilter;
    const importedMask = new ImportedContourMask();
    const material = new ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        simsStyle: { value: false },
        inkStrength: { value: 0.72 },
        beauty: { value: target.texture },
        importedDepth: { value: importedMask.target.depthTexture },
        hasImportedModels: { value: false },
        sceneDepth: { value: target.depthTexture },
        texel: { value: new Vector2() },
        nearPlane: { value: 0.1 },
        farPlane: { value: 100 },
        perspective: { value: true },
        ink: { value: new Color("#35434c") },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: contourFragmentShader,
    });
    return {
      target,
      importedMask,
      material,
      quad: new FullScreenQuad(material),
      size: new Vector2(),
      shadows: new ShadowMapCache(),
      batches: new SceneToonBatcher(),
      lod: new SceneGeometryLod(invalidate),
      warmup: new SceneShaderWarmup(),
    };
  }, [antialias, invalidate]);
  useEffect(
    () => () => {
      resources.target.dispose();
      resources.importedMask.dispose();
      resources.material.dispose();
      resources.quad.dispose();
      resources.batches.dispose();
      resources.lod.dispose();
      resources.warmup.dispose();
    },
    [resources],
  );
  useEffect(() => {
    const restored = () => {
      resources.shadows.reset();
      resources.warmup.reset();
      invalidate();
    };
    gl.domElement.addEventListener("webglcontextrestored", restored);
    return () => gl.domElement.removeEventListener("webglcontextrestored", restored);
  }, [gl, resources, invalidate]);
  useEffect(() => {
    resources.material.uniforms.inkStrength.value = detailedFinishes ? 0.35 : 0.72;
    resources.material.uniforms.simsStyle.value = style === "sims";
    invalidate();
  }, [style, detailedFinishes, resources, invalidate]);
  // Positive priority owns rendering, but never invalidates a resting demand canvas.
  useFrame(({ gl, scene, camera }) => {
    if (!active) {
      resources.shadows.reset();
      gl.render(scene, camera);
      return;
    }
    const { target, material, quad, size } = resources;
    gl.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    const lens = camera as PerspectiveCamera;
    material.uniforms.nearPlane.value = lens.near;
    material.uniforms.farPlane.value = lens.far;
    material.uniforms.perspective.value = Boolean(lens.isPerspectiveCamera);
    // About one CSS pixel, including high-DPI and adaptive-resolution canvases.
    (material.uniforms.texel.value as import("three").Vector2).set(
      gl.getPixelRatio() / size.x,
      gl.getPixelRatio() / size.y,
    );
    const previousTarget = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    // Set when new shader programs are compiling; the previous frame stays on screen.
    let compiling = false;
    try {
      gl.autoClear = true;
      gl.setRenderTarget(target);
      resources.shadows.render(gl, scene, camera, () =>
        resources.lod.render(scene, camera, size.y / gl.getPixelRatio(), () => {
          const pending = resources.batches.render(gl, scene, camera, () => {
            lightWalls.prepare(scene);
            compiling = !resources.warmup.render(
              gl,
              scene,
              camera,
              () => gl.render(scene, camera),
              invalidate,
            );
          });
          if (pending) invalidate();
        }),
      );
      // A synchronous compile here would queue behind the programs still compiling.
      if (!compiling) {
        material.uniforms.hasImportedModels.value = resources.importedMask.render(
          gl,
          scene,
          camera,
          size.x,
          size.y,
        );
        gl.setRenderTarget(previousTarget);
        quad.render(gl);
      }
    } catch (error) {
      if (!onRenderFailure) throw error;
      onRenderFailure(error);
      return;
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.autoClear = autoClear;
    }
    // The architecture and compositor share a Suspense boundary. An empty
    // scene or a lost context can still let WebGL render an empty quad.
    if (
      onFirstFrame &&
      !presented.current &&
      scene.getObjectByName("architecture-scene")?.getObjectByProperty("isMesh", true)
    ) {
      if (gl.getContext().isContextLost()) {
        onRenderFailure?.(new Error("The WebGL context was lost."));
        return;
      }
      if (compiling) return; // Present once the compiled frame has drawn.
      presented.current = true;
      onFirstFrame();
    }
  }, 1);
  return null;
}

export function StylizedScene({
  children,
  enabled = true,
  antialias = true,
  active = true,
  onFirstFrame,
}: {
  children: ReactNode;
  enabled?: boolean;
  antialias?: boolean;
  /** Suspend postprocessing without disposing its resources or changing model outlines. */
  active?: boolean;
  onFirstFrame?: (() => void) | null | undefined;
}) {
  const style = useSceneStyle();
  const studioLighting = useGraphicsFeature("lighting");
  const lightWalls = useMemo(() => new SceneLightWallMask(), []);
  useEffect(() => () => lightWalls.dispose(), [lightWalls]);
  return (
    <SceneLightWallMaskContext.Provider value={lightWalls}>
      <SceneContourContext.Provider value={enabled}>
        <SceneStyleContext.Provider value={active ? style : "default"}>
          {active && studioLighting && style === "default" && <SceneEnvironment />}
          {children}
        </SceneStyleContext.Provider>
        {enabled && (
          <SceneContourPass antialias={antialias} active={active} onFirstFrame={onFirstFrame} />
        )}
      </SceneContourContext.Provider>
    </SceneLightWallMaskContext.Provider>
  );
}
