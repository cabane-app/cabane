import { SceneStyleContext } from "./scene-style";
import { simsGradient, simsMaterialColor } from "./sims-material-style";
import { omitUndefinedProperties } from "./defined-properties";
import type { OutlinesProps as DreiOutlinesProps } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  type ColorRepresentation,
  DataTexture,
  LinearFilter,
  RedFormat,
  type Group,
  type Mesh,
  type MeshToonMaterial,
} from "three";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
} from "react";
import { cameraFacingWallOpacityForNormals } from "./wall-fade";
import { SceneContourContext } from "./StylizedScene";
import { SceneOutlines } from "./SceneOutlines";
import { SceneLightWallMaskContext } from "./scene-light-wall-mask";

export const TOON_GRADIENT_DATA = [55, 115, 185, 255] as const;
// Wide constant bands retain cel shading. Linear filtering only blends their
// one-texel boundaries, so view-space dot-product roundoff cannot flash a whole
// planar wall between two bands (especially when sunlight is parallel to it).
const TOON_BAND_TEXELS = 64;
const toonGradient = new DataTexture(
  Uint8Array.from(
    { length: TOON_GRADIENT_DATA.length * TOON_BAND_TEXELS },
    (_, index) => TOON_GRADIENT_DATA[Math.floor(index / TOON_BAND_TEXELS)],
  ),
  TOON_GRADIENT_DATA.length * TOON_BAND_TEXELS,
  1,
  RedFormat,
);
toonGradient.minFilter = LinearFilter;
toonGradient.magFilter = LinearFilter;
toonGradient.generateMipmaps = false;
toonGradient.needsUpdate = true;

export type ToonMaterialProps = Omit<
  ComponentProps<"meshToonMaterial">,
  "gradientMap" | "onUpdate"
> & {
  onUpdate?: (material: MeshToonMaterial) => void;
};

/** Local colour lift for interactive device models, preserving their live state. */
export const DeviceHoverContext = createContext(false);

export function ToonMaterial(props: ToonMaterialProps) {
  const style = useContext(SceneStyleContext);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  }, [style, invalidate]);
  const hovered = useContext(DeviceHoverContext);
  const lightWalls = useContext(SceneLightWallMaskContext);
  const { onUpdate: authoredUpdate } = props;
  const onUpdate = useCallback(
    (material: MeshToonMaterial) => {
      if (material.userData.cabaneSceneStyle !== style) {
        material.userData.cabaneSceneStyle = style;
        material.needsUpdate = true;
      }
      authoredUpdate?.(material);
      lightWalls?.prepareMaterial(material);
    },
    [authoredUpdate, lightWalls, style],
  );
  let color = style === "sims" ? simsMaterialColor(props.color ?? "white") : props.color;
  if (hovered) {
    const source = color ?? "white";
    const tint = Array.isArray(source)
      ? source.length === 3
        ? new Color(...(source as [number, number, number]))
        : new Color(source[0] as ColorRepresentation)
      : new Color(source as ColorRepresentation);
    color = tint.lerp(new Color("white"), 0.08);
  }
  return (
    <meshToonMaterial
      {...props}
      onUpdate={onUpdate}
      {...omitUndefinedProperties({ color: color })}
      defines={style === "sims" ? { ...props.defines, FLAT_SHADED: "" } : { ...props.defines }}
      gradientMap={style === "sims" ? simsGradient : toonGradient}
    />
  );
}

export type OutlinesProps = DreiOutlinesProps;

export function Outlines({
  color = "#4d5c57",
  thickness = 0.012,
  screenspace = false,
  ...props
}: OutlinesProps) {
  const sceneContours = useContext(SceneContourContext);
  if (sceneContours) return null;
  return <SceneOutlines color={color} thickness={thickness} screenspace={screenspace} {...props} />;
}

export const applyCameraFadeToMesh = (mesh: Mesh, opacity: number, retainShadows = false) => {
  if (mesh.userData.cameraFadeBaseCastShadow === undefined) {
    mesh.userData.cameraFadeBaseCastShadow = mesh.castShadow;
  }
  mesh.castShadow =
    Boolean(mesh.userData.cameraFadeBaseCastShadow) && (retainShadows || opacity >= 0.995);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (material.userData.cameraFadeBaseOpacity === undefined) {
      material.userData.cameraFadeBaseOpacity = material.opacity;
      material.userData.cameraFadeBaseTransparent = material.transparent;
      material.userData.cameraFadeBaseDepthWrite = material.depthWrite;
    }
    const baseOpacity = Number(material.userData.cameraFadeBaseOpacity);
    const baseTransparent = Boolean(material.userData.cameraFadeBaseTransparent);
    const baseDepthWrite = Boolean(material.userData.cameraFadeBaseDepthWrite);
    const transparent = baseTransparent || opacity < 0.999;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = baseOpacity * opacity;
    material.depthWrite = baseDepthWrite && opacity >= 0.995;
  }
};

export function CameraFacingFade({
  enabled,
  normal,
  normals,
  reducedMotion = false,
  retainShadows = false,
  children,
}: {
  enabled: boolean;
  normal?: readonly [number, number];
  normals?: readonly (readonly [number, number])[];
  center?: readonly [number, number];
  reducedMotion?: boolean;
  retainShadows?: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  const opacityRef = useRef(1);
  const { invalidate } = useThree();
  const fadeNormals = normals ?? (normal ? [normal] : []);
  const applyOpacity = useCallback(
    (opacity: number) => {
      groupRef.current?.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        applyCameraFadeToMesh(mesh, opacity, retainShadows);
      });
    },
    [retainShadows],
  );
  useEffect(() => {
    if (!enabled) opacityRef.current = 1;
    // New meshes and replacement materials inherit the current fade at a stationary camera.
    applyOpacity(opacityRef.current);
    invalidate();
  }, [enabled, invalidate, normal, normals, reducedMotion, applyOpacity, children]);
  useFrame(({ camera }, delta) => {
    const target = cameraFacingWallOpacityForNormals(
      enabled,
      [camera.position.x, camera.position.z],
      fadeNormals,
    );
    const next = reducedMotion
      ? target
      : opacityRef.current + (target - opacityRef.current) * (1 - Math.exp(-12 * delta));
    const resolved = Math.abs(next - target) < 0.002 ? target : next;
    if (Math.abs(resolved - opacityRef.current) > 0.0005) {
      opacityRef.current = resolved;
      applyOpacity(resolved);
    }
    if (Math.abs(resolved - target) >= 0.002) invalidate();
  });
  return <group ref={groupRef}>{children}</group>;
}
