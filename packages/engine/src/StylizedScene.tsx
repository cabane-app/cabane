import { SceneStyleContext, useSceneStyle } from "./scene-style";
import { ImportedContourMask } from "./imported-models/contour-mask";
import { contourFragmentShader } from "./scene-contour-shader";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
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

/** Decorative mesh shells are replaced by a single visible-depth contour pass. */
export const SceneContourContext = createContext(false);

function SceneContourPass({ antialias, active }: { antialias: boolean; active: boolean }) {
  const style = useSceneStyle();
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const lightWalls = useContext(SceneLightWallMaskContext)!;
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
    },
    [resources],
  );
  useEffect(() => {
    gl.domElement.addEventListener("webglcontextrestored", resources.shadows.reset);
    return () => gl.domElement.removeEventListener("webglcontextrestored", resources.shadows.reset);
  }, [gl, resources]);
  useEffect(() => {
    resources.material.uniforms.simsStyle.value = style === "sims";
    invalidate();
  }, [style, resources, invalidate]);
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
    try {
      gl.autoClear = true;
      gl.setRenderTarget(target);
      resources.shadows.render(gl, scene, camera, () =>
        resources.lod.render(scene, camera, size.y / gl.getPixelRatio(), () =>
          resources.batches.render(gl, scene, camera, () => lightWalls.render(gl, scene, camera)),
        ),
      );
      material.uniforms.hasImportedModels.value = resources.importedMask.render(
        gl,
        scene,
        camera,
        size.x,
        size.y,
      );
      gl.setRenderTarget(previousTarget);
      quad.render(gl);
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.autoClear = autoClear;
    }
  }, 1);
  return null;
}

export function StylizedScene({
  children,
  enabled = true,
  antialias = true,
  active = true,
}: {
  children: ReactNode;
  enabled?: boolean;
  antialias?: boolean;
  /** Suspend postprocessing without disposing its resources or changing model outlines. */
  active?: boolean;
}) {
  const style = useSceneStyle();
  const lightWalls = useMemo(() => new SceneLightWallMask(), []);
  useEffect(() => () => lightWalls.dispose(), [lightWalls]);
  return (
    <SceneLightWallMaskContext.Provider value={lightWalls}>
      <SceneContourContext.Provider value={enabled}>
        <SceneStyleContext.Provider value={active ? style : "default"}>
          {children}
        </SceneStyleContext.Provider>
        {enabled && <SceneContourPass antialias={antialias} active={active} />}
      </SceneContourContext.Provider>
    </SceneLightWallMaskContext.Provider>
  );
}
