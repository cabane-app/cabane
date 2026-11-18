import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Texture, type DirectionalLight, type ShaderMaterial } from "three";
import { scan, useScannedFinish } from "../scanned-finishes";
import foliageUrl from "./assets/field-foliage.webp?url";
import facadeUrl from "./assets/brick-window.webp?url";
import type { HomeManifest } from "../types";
import { worldBoundsForFloorScene } from "../pools/pool-footprint";
import { deriveFloorLevels } from "../building/floor-levels";
import { countryside } from "./countryside";
import { newYork } from "./new-york";
import type { Landscape } from "./landscape-preference";
import { landscapeFragment, landscapeVertex } from "./landscape-shader";

const leaves = scan(foliageUrl);
const brick = scan(facadeUrl);
const noTexture = () => null;
const noSubscription = () => () => {};

export function HomeLandscape({
  landscape,
  manifest,
  daylight,
  overcast,
  sunRef,
}: {
  landscape: Exclude<Landscape, "none">;
  manifest: HomeManifest;
  daylight: number;
  overcast: number;
  sunRef: RefObject<DirectionalLight | null>;
}) {
  const scenery = useMemo(
    () => (landscape === "new-york" ? newYork() : countryside()),
    [landscape],
  );
  useEffect(
    () => () => {
      scenery.geometry.dispose();
      scenery.shade.dispose();
    },
    [scenery],
  );
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
    return {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      y: base - apartment - 0.44,
      scale: Math.max(0.85, (Math.max(maxX - minX, maxZ - minZ) + 7) / 21),
    };
  }, [manifest.floors, manifest.home.apartmentFloor]);
  const ground = useScannedFinish(
    landscape === "countryside" ? "ground-cover" : undefined,
    "grounds",
  );
  const foliage = useSyncExternalStore(leaves.subscribe, leaves.snapshot, noTexture);
  const facade = useSyncExternalStore(
    landscape === "new-york" ? brick.subscribe : noSubscription,
    brick.snapshot,
    noTexture,
  );
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      shadeMap: { value: null as Texture | null },
      ground: { value: null as Texture | null },
      hasGround: { value: false },
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
    live.ground.value = ground ?? null;
    live.hasGround.value = Boolean(ground);
    live.leaves.value = foliage ?? null;
    live.brick.value = facade ?? null;
    live.hasBrick.value = Boolean(facade);
    live.sun.value.copy(light.position).sub(light.target.position).normalize();
    live.daylight.value = daylight;
    live.overcast.value = overcast;
  }, -0.5);
  return (
    <mesh
      name={`landscape-${landscape}`}
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
