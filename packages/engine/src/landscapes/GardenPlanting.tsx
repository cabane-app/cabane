import { Suspense, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  Color,
  SRGBColorSpace,
  DoubleSide,
  MeshStandardMaterial,
  NoColorSpace,
  type BufferGeometry,
  type Mesh,
} from "three";
import { PlantInstances, Shelter } from "./PlantInstances";
import firBoughUrl from "./assets/fir-bough.png?url";
import { ridgeFir } from "./ridge-fir";
import { fallenBough, fallenBoughMaterial } from "./fallen-bough";
import { scan } from "../scanned-finishes";
import type { gardenLayout } from "./garden-layout";
import { fieldstone, groundcoverSpecimen } from "./garden-groundcover";
import type { CountryPlanet } from "./country-planet";
import { plantMaterial, type GardenLight } from "./plant-material";
import gardenKitUrl from "./assets/garden-trees.glb?url";
import { countrysideStoneScan } from "./CountryTurf";
import stoneNormalUrl from "./assets/mossy-stone-normal.webp?url";

const stoneNormal = scan(stoneNormalUrl, 1, NoColorSpace);
const none = () => null;
type Height = (x: number, z: number) => number;

type Layout = ReturnType<typeof gardenLayout>;
// Reserve individual fir sprays for crowns large enough to resolve them.
const firLods = [
  { near: true, pixels: 22 },
  { near: false, pixels: 22 },
] as const;
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
  const color = useSyncExternalStore(
    countrysideStoneScan.subscribe,
    countrysideStoneScan.snapshot,
    none,
  );
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
  planet,
  daylight,
  walkMode,
  wind,
}: {
  layout: Layout;
  shelterAt: Height;
  planet: CountryPlanet;
  daylight: number;
  walkMode: boolean;
  wind: boolean;
}) {
  const light = useMemo<GardenLight>(
    () => ({ breeze: { value: 0 }, air: { value: new Color() }, halfHeight: { value: 0 } }),
    [],
  );
  useLayoutEffect(() => {
    light.air.value.setRGB(0.052 + 0.418 * daylight, 0.07 + 0.52 * daylight, 0.1 + 0.58 * daylight);
  }, [light, daylight]);
  useFrame(({ gl }, delta) => {
    if (walkMode) light.halfHeight.value = gl.domElement.height * 0.5;
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
          <WoodyPlanting layout={layout} planet={planet} light={light} walkMode={walkMode} />
        </Suspense>
        <Suspense fallback={null}>
          <RidgeFirs plants={layout.firs} planet={planet} light={light} walkMode={walkMode} />
        </Suspense>
        {(["ferns", "rosettes", "sedges", "grasses", "stones", "litter"] as const).map((k) => (
          <PlantInstances
            key={k}
            name={"garden-" + k}
            geometry={shapes[k]}
            plants={layout[k]}
            planet={planet}
            material={k === "stones" || k === "litter" ? undefined : coverMaterial}
            detailPixels={
              k === "grasses" ? 85 : k === "litter" ? 85 : k === "stones" ? undefined : 54
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

function RidgeFirs({
  plants,
  planet,
  light,
  walkMode,
}: {
  plants: Layout["firs"];
  planet: CountryPlanet;
  light: GardenLight;
  walkMode: boolean;
}) {
  const map = useTexture(firBoughUrl);
  const geometry = useMemo(() => [ridgeFir(), ridgeFir(true)], []);
  const materials = useMemo(() => {
    map.colorSpace = SRGBColorSpace;
    const source = new MeshStandardMaterial({ map, side: DoubleSide, vertexColors: true });
    // Preserve the coverage of fine needles as they collapse into the last mip levels.
    const materials = [0.29, 0.13].map((alphaTest, i) => {
      source.alphaTest = alphaTest;
      return plantMaterial(source, light, false, true, false, walkMode ? firLods[i] : undefined);
    });
    source.dispose();
    return materials;
  }, [map, light, walkMode]);
  useEffect(() => () => geometry.forEach((shape) => shape.dispose()), [geometry]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  return geometry.map((shape, i) => (
    <PlantInstances
      key={i}
      name={i ? "garden-ridge-firs-mid" : "garden-ridge-firs"}
      geometry={shape}
      material={materials[i]}
      plants={plants}
      planet={planet}
      distant
      castShadow={false}
      lod={firLods[i]}
    />
  ));
}

function WoodyPlanting({
  layout,
  planet,
  light,
  walkMode,
}: {
  layout: Layout;
  planet: CountryPlanet;
  light: GardenLight;
  walkMode: boolean;
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
        (["bark", "leaves"] as const).flatMap((part) => {
          const mesh = nodes[kind + "-" + part] as Mesh<BufferGeometry, MeshStandardMaterial>;
          const distant = kind.startsWith("distant");
          const mid = (nodes[kind + "-" + part + "-mid"] as Mesh | undefined)?.geometry;
          // In Orbit only one level is visible, so both levels can reuse the original shader.
          const shared =
            walkMode && mid
              ? null
              : plantMaterial(mesh.material, light, part === "leaves", distant);
          return (mid ? [mesh.geometry, mid] : [mesh.geometry]).map((geometry, i) => {
            const lod = mid ? { near: i === 0, pixels: 64 } : undefined;
            return {
              kind,
              part,
              geometry,
              lod,
              distant,
              material:
                shared ??
                plantMaterial(mesh.material, light, part === "leaves", distant, false, lod),
            };
          });
        }),
      ),
    [nodes, light, walkMode],
  );
  useEffect(
    () => () => {
      for (const material of new Set(batches.map((b) => b.material))) material.dispose();
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
        planet={planet}
        geometry={log.geometry}
        material={log.material}
        lieFlat
      />
      {batches.map(({ kind, part, geometry, lod, material, distant }) => {
        const name =
          "garden-" +
          kind +
          "-" +
          (part === "bark" ? "wood" : part) +
          (lod && !lod.near ? "-mid" : "");
        return (
          <PlantInstances
            key={name}
            name={name}
            geometry={geometry}
            plants={kinds[kind]}
            planet={planet}
            material={material}
            distant={distant}
            castShadow={!distant && (!walkMode || !lod?.near)}
            lod={lod}
          />
        );
      })}
    </>
  );
}
