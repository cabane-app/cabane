import { Suspense, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  NoColorSpace,
  type BufferGeometry,
  type PlaneGeometry,
  type Mesh,
} from "three";
import { PlantInstances, Shelter } from "./PlantInstances";
import { fallenBough, fallenBoughMaterial } from "./fallen-bough";
import { scan } from "../scanned-finishes";
import type { gardenLayout } from "./garden-layout";
import { fieldstone, groundcoverSpecimen } from "./garden-groundcover";
import { meshHeightAt } from "./country-survey";
import { plantMaterial, type GardenLight } from "./plant-material";
import gardenKitUrl from "./assets/garden-trees.glb?url";
import stoneUrl from "./assets/mossy-stone.webp?url";
import stoneNormalUrl from "./assets/mossy-stone-normal.webp?url";

const stoneColor = scan(stoneUrl),
  stoneNormal = scan(stoneNormalUrl, 1, NoColorSpace);
const none = () => null;
type Height = (x: number, z: number) => number;

type Layout = ReturnType<typeof gardenLayout>;
const treeKinds = [
  "spreading",
  "upright",
  "mature",
  "sapling",
  "shrubs",
  "thicket",
  "distantOak",
  "distantAsh",
] as const;
function FieldstoneMaterial() {
  const color = useSyncExternalStore(stoneColor.subscribe, stoneColor.snapshot, none);
  const relief = useSyncExternalStore(stoneNormal.subscribe, stoneNormal.snapshot, none);
  return (
    <meshStandardMaterial
      vertexColors
      color="#b6bc9e"
      map={color ?? null}
      normalMap={relief ?? null}
      roughness={1}
    />
  );
}

export function GardenPlanting({
  layout,
  shelterAt,
  near,
  far,
  daylight,
  wind,
}: {
  layout: Layout;
  shelterAt: Height;
  near: PlaneGeometry;
  far: PlaneGeometry;
  daylight: number;
  wind: boolean;
}) {
  const height = useMemo(
    () => (x: number, z: number) =>
      meshHeightAt(
        Math.max(Math.abs(x), Math.abs(z)) <= near.parameters.width / 2 ? near : far,
        x,
        z,
      ),
    [near, far],
  );
  const light = useMemo<GardenLight>(
    () => ({ breeze: { value: 0 }, air: { value: new Color() } }),
    [],
  );
  useLayoutEffect(() => {
    light.air.value.setRGB(0.052 + 0.418 * daylight, 0.07 + 0.52 * daylight, 0.1 + 0.58 * daylight);
  }, [light, daylight]);
  useFrame((_, delta) => {
    if (wind) light.breeze.value += Math.min(0.06, delta);
  }, -0.5);
  const shapes = useMemo(
    () => ({
      ferns: groundcoverSpecimen("ferns"),
      rosettes: groundcoverSpecimen("rosettes"),
      sedges: groundcoverSpecimen("sedges"),
      grasses: groundcoverSpecimen("grasses"),
      litter: groundcoverSpecimen("litter"),
      stones: fieldstone(),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const shape of Object.values(shapes)) shape.dispose();
    },
    [shapes],
  );
  const coverMaterial = useMemo(() => {
    const base = new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide });
    const material = plantMaterial(base, light, true, false, true);
    base.dispose();
    return material;
  }, [light]);
  useEffect(() => () => coverMaterial.dispose(), [coverMaterial]);
  return (
    <Shelter.Provider value={shelterAt}>
      <group name="garden-planting">
        <Suspense fallback={null}>
          <WoodyPlanting layout={layout} height={height} light={light} />
        </Suspense>
        {(["ferns", "rosettes", "sedges", "grasses", "stones", "litter"] as const).map((k) => (
          <PlantInstances
            key={k}
            name={"garden-" + k}
            geometry={shapes[k]}
            plants={layout[k]}
            height={height}
            material={k === "stones" || k === "litter" ? undefined : coverMaterial}
            detailPixels={
              k === "grasses" ? 65 : k === "litter" ? 85 : k === "stones" ? undefined : 42
            }
            lieFlat={k === "litter" || k === "stones"}
            castShadow={k === "stones"}
          >
            {k === "stones" ? (
              <FieldstoneMaterial />
            ) : k === "litter" ? (
              <meshStandardMaterial vertexColors roughness={1} side={DoubleSide} />
            ) : null}
          </PlantInstances>
        ))}
      </group>
    </Shelter.Provider>
  );
}

function WoodyPlanting({
  layout,
  height,
  light,
}: {
  layout: Layout;
  height: Height;
  light: GardenLight;
}) {
  const { nodes } = useGLTF(gardenKitUrl, false, false);
  const log = useMemo(() => {
    const geometry = fallenBough();
    const source = nodes["spreading-bark"] as Mesh<BufferGeometry, MeshStandardMaterial>;
    const material = fallenBoughMaterial(source.material);
    return { geometry, material };
  }, [nodes]);
  useEffect(
    () => () => {
      log.geometry.dispose();
      log.material.dispose();
    },
    [log],
  );
  const batches = useMemo(
    () =>
      treeKinds.flatMap((kind) =>
        (["bark", "leaves"] as const).map((part) => {
          const mesh = nodes[kind + "-" + part] as Mesh<BufferGeometry, MeshStandardMaterial>;
          const distant = kind.startsWith("distant");
          return {
            kind,
            part,
            geometry: mesh.geometry,
            mid: (nodes[kind + "-" + part + "-mid"] as Mesh | undefined)?.geometry,
            distant,
            material: plantMaterial(mesh.material, light, part === "leaves", distant),
          };
        }),
      ),
    [nodes, light],
  );
  useEffect(
    () => () => {
      for (const b of batches) b.material.dispose();
    },
    [batches],
  );
  const kinds = useMemo(
    () => ({
      spreading: layout.trees.filter((_, i) => i % 4 === 0),
      upright: layout.trees.filter((_, i) => i % 4 === 1),
      mature: layout.trees.filter((_, i) => i % 4 === 2),
      sapling: layout.trees.filter((_, i) => i % 4 === 3),
      shrubs: layout.shrubs.filter((_, i) => i % 3 !== 0),
      thicket: layout.shrubs.filter((_, i) => i % 3 === 0),
      distantOak: layout.distant.filter((_, i) => i % 2 === 0),
      distantAsh: layout.distant.filter((_, i) => i % 2 !== 0),
    }),
    [layout],
  );
  return (
    <>
      <PlantInstances
        name="garden-deadwood"
        plants={layout.boughs}
        height={height}
        geometry={log.geometry}
        material={log.material}
        lieFlat
      />
      {batches.flatMap(({ kind, part, geometry, mid, material, distant }) =>
        (mid ? [geometry, mid] : [geometry]).map((shape, i) => (
          <PlantInstances
            key={kind + part + i}
            name={"garden-" + kind + "-" + (part === "bark" ? "wood" : part) + (i ? "-mid" : "")}
            geometry={shape}
            plants={kinds[kind]}
            height={height}
            material={material}
            distant={distant}
            castShadow={!distant}
            lod={mid ? (i ? "mid" : "near") : undefined}
          />
        )),
      )}
    </>
  );
}
