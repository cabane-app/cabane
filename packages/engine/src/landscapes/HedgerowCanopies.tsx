import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ClampToEdgeWrapping,
  DoubleSide,
  InstancedBufferGeometry,
  NearestFilter,
  NoColorSpace,
  PlaneGeometry,
  Vector2,
  Vector4,
  type ShaderMaterial,
} from "three";
import { scan } from "../scanned-finishes";
import samplesUrl from "./assets/hedgerow-points.png?url";
import spraysUrl from "./assets/hedgerow-sprays.webp?url";
import { canopyFragment, canopyVertex } from "./hedgerow-shaders";
import { type FieldPlot } from "./country-survey";
import { localHeights } from "./CountryFields";
import { hedgerowWood } from "./hedgerow-wood";

const points = scan(samplesUrl, 1, NoColorSpace, (map) => {
  map.magFilter = map.minFilter = NearestFilter;
  map.generateMipmaps = false;
  map.wrapS = map.wrapT = ClampToEdgeWrapping;
  map.flipY = false;
});
const sprays = scan(spraysUrl);
const none = () => null;
export function HedgerowCanopies({
  plot,
  daylight,
  overcast,
  wind,
}: {
  plot: FieldPlot;
  daylight: number;
  overcast: number;
  wind: boolean;
}) {
  const p = useSyncExternalStore(points.subscribe, points.snapshot, none);
  const leaves = useSyncExternalStore(sprays.subscribe, sprays.snapshot, none);
  const soil = useSyncExternalStore(localHeights.subscribe, localHeights.snapshot, none);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1, 1, 3),
      geo = new InstancedBufferGeometry();
    geo.setIndex(plane.index);
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));
    return geo;
  }, []);
  const wood = useMemo(() => hedgerowWood(plot), [plot]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => wood.dispose(), [wood]);
  const uniforms = useMemo(() => {
    const t = plot.terrain;
    const x0 = t?.gridX[0] ?? 0,
      z0 = t?.gridZ[0] ?? 0,
      x1 = t?.gridX.at(-1) ?? 1,
      z1 = t?.gridZ.at(-1) ?? 1;
    return {
      samples: { value: p },
      sprays: { value: leaves },
      heights: { value: soil },
      lotCenter: { value: new Vector2(plot.x - plot.surveyX, plot.z - plot.surveyZ) },
      halfLot: { value: new Vector2(plot.width / 2, plot.depth / 2) },
      scaleMeters: { value: plot.surveyScale },
      gradeBounds: {
        value: new Vector4(
          x0 - plot.surveyX,
          z0 - plot.surveyZ,
          x1 - plot.surveyX,
          z1 - plot.surveyZ,
        ),
      },
      gradeCorners: {
        value: new Vector4(
          t?.offsetAt(x0, z0) ?? 0,
          t?.offsetAt(x1, z0) ?? 0,
          t?.offsetAt(x0, z1) ?? 0,
          t?.offsetAt(x1, z1) ?? 0,
        ),
      },
      daylight: { value: daylight },
      overcast: { value: overcast },
      seconds: { value: 0 },
    };
  }, [plot, p, leaves, soil, daylight, overcast]);
  const material = useRef<ShaderMaterial>(null);
  useFrame((_, delta) => {
    if (wind && material.current) material.current.uniforms.seconds.value += Math.min(0.08, delta);
  }, -0.5);
  return (
    <>
      <mesh name="country-trunks" geometry={wood} castShadow receiveShadow raycast={() => {}}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {p && p.image instanceof HTMLImageElement && leaves && soil && (
        <mesh
          name="country-hedgerows"
          geometry={geometry}
          geometry-instanceCount={(p.image.width / 2) * p.image.height}
          frustumCulled={false}
          raycast={() => {}}
        >
          <shaderMaterial
            ref={material}
            uniforms={uniforms}
            side={DoubleSide}
            toneMapped={false}
            vertexShader={canopyVertex}
            fragmentShader={canopyFragment}
          />
        </mesh>
      )}
    </>
  );
}
