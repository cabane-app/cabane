import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Texture, type DirectionalLight, type ShaderMaterial } from "three";
import { scan } from "../scanned-finishes";
import { useGraphicsFeature } from "../graphics-features";
import { useSceneStyle } from "../scene-style";
import foliageUrl from "./assets/field-foliage.webp?url";
import facadeUrl from "./assets/brick-window.webp?url";
import type { DeviceModelRegistry, HomeManifest } from "../types";
import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { deriveFloorLevels } from "../building/floor-levels";

import { homeGroundFrame } from "../architecture-scene/diorama-frame";
import { createTerrainSurface } from "../terrain/terrain-surface";
import { newYork } from "./new-york";
import type { Landscape } from "./landscape-preference";
import { landscapeFragment, landscapeVertex } from "./landscape-shader";

const Countryside = lazy(() =>
  import("./RuralLandscape").then((module) => ({ default: module.Countryside })),
);
const leaves = scan(foliageUrl);
const brick = scan(facadeUrl);
const noTexture = () => null;

type LandscapeLighting = {
  daylight: number;
  overcast: number;
  sunRef: RefObject<DirectionalLight | null>;
};

export function HomeLandscape({
  landscape,
  manifest,
  devices,
  walkMode,
  reducedMotion,
  ...lighting
}: LandscapeLighting & {
  landscape: Exclude<Landscape, "none">;
  manifest: HomeManifest;
  devices: DeviceModelRegistry;
  walkMode: boolean;
  reducedMotion: boolean;
}) {
  const grounds = useGraphicsFeature("grounds");
  const style = useSceneStyle();
  const frame = useMemo(() => {
    const bounds = manifest.floors.map(worldBoundsForFloorScene);
    const minX = Math.min(...bounds.map((b) => b.minX)),
      maxX = Math.max(...bounds.map((b) => b.maxX));
    const minZ = Math.min(...bounds.map((b) => b.minZ)),
      maxZ = Math.max(...bounds.map((b) => b.maxZ));
    const levels = deriveFloorLevels(manifest.floors);
    const base = manifest.home.apartmentFloor
      ? levels[0].elevationMeters
      : levels[
          Math.max(
            0,
            manifest.floors.findIndex((f) => !f.belowGround),
          )
        ].elevationMeters;
    const apartment =
      (manifest.home.apartmentFloor ?? 0) * manifest.floors[0].floorToFloorHeightMeters;
    const lot =
      landscape === "countryside" || manifest.home.groundMargins
        ? homeGroundFrame(
            manifest,
            devices,
            walkMode || !grounds || style !== "default" ? "walk" : "orbit",
          )
        : null;
    const span = lot ? Math.max(lot.width, lot.depth) : Math.max(maxX - minX, maxZ - minZ) + 7;
    // The clearing sits on an open field edge with a long sightline across the valley.
    const surveyScale = Math.max(0.48, (Math.max(maxX - minX, maxZ - minZ) + 5) / 49);
    return {
      span,
      surveyX: (minX + maxX) / 2,
      surveyZ: (minZ + maxZ) / 2 + 58 * surveyScale,
      surveyScale,
      groundColor: manifest.home.palette.ground,
      width: lot?.width ?? span,
      depth: lot?.depth ?? span,
      terrain:
        landscape === "countryside" && !apartment
          ? createTerrainSurface(manifest.home.terrain, manifest.floors)
          : null,
      x: lot?.centerX ?? (minX + maxX) / 2,
      z: lot?.centerZ ?? (minZ + maxZ) / 2,
      y: base - apartment - (landscape === "countryside" ? 0.07 : 0.44),
      scale: Math.max(0.85, span / 21),
    };
  }, [manifest, devices, landscape, walkMode, grounds, style]);
  return landscape === "countryside" ? (
    <Suspense fallback={null}>
      <Countryside
        frame={frame}
        walkMode={walkMode}
        reducedMotion={reducedMotion}
        daylight={lighting.daylight}
        overcast={lighting.overcast}
      />
    </Suspense>
  ) : (
    <CityLandscape frame={frame} {...lighting} />
  );
}

function CityLandscape({
  frame,
  daylight,
  overcast,
  sunRef,
}: LandscapeLighting & {
  frame: { x: number; y: number; z: number; scale: number };
}) {
  const scenery = useMemo(newYork, []);
  useEffect(
    () => () => {
      scenery.geometry.dispose();
      scenery.shade.dispose();
    },
    [scenery],
  );
  const foliage = useSyncExternalStore(leaves.subscribe, leaves.snapshot, noTexture);
  const facade = useSyncExternalStore(brick.subscribe, brick.snapshot, noTexture);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      shadeMap: { value: null as Texture | null },
      brick: { value: null as Texture | null },
      hasBrick: { value: false },
      leaves: { value: null as Texture | null },
      sun: { value: new Vector3(-8, 14, 10).normalize() },
      daylight: { value: 1 },
      overcast: { value: 0 },
    }),
    [],
  );
  useFrame(() => {
    const live = material.current?.uniforms as typeof uniforms | undefined;
    const light = sunRef.current;
    if (!live || !light) return;
    live.shadeMap.value = scenery.shade;
    live.leaves.value = foliage ?? null;
    live.brick.value = facade ?? null;
    live.hasBrick.value = Boolean(facade);
    live.sun.value.copy(light.position).sub(light.target.position).normalize();
    live.daylight.value = daylight;
    live.overcast.value = overcast;
  }, -0.5);
  return (
    <mesh
      name="landscape-new-york"
      geometry={scenery.geometry}
      position={[frame.x, frame.y, frame.z]}
      scale={frame.scale}
      renderOrder={-950}
      frustumCulled={false}
      raycast={() => {}}
    >
      <shaderMaterial
        ref={material}
        vertexColors
        uniforms={uniforms}
        vertexShader={landscapeVertex}
        fragmentShader={landscapeFragment}
      />
    </mesh>
  );
}
