import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Mesh } from "three";
import { useThree } from "@react-three/fiber";
import { countryOrbitBounds } from "./landscape-frame";
import { GardenPlanting, type useGardenPlantingAssets } from "./GardenPlanting";
import { gardenLayout } from "./garden-layout";
import { plantingMask } from "./planting-mask";
import { CountryTurf } from "./CountryTurf";
import { surveyGrade, type FieldPlot } from "./country-survey";
import { countryPlanet, planetGeometry } from "./country-planet";
import { planetScans } from "./planet-scans";

const { heights } = planetScans;
const noRaster = () => undefined;

export function CountryGround({
  planting,
  plot,
  daylight,
  walkMode,
  wind,
}: {
  planting: ReturnType<typeof useGardenPlantingAssets>;
  plot: FieldPlot;
  daylight: number;
  walkMode: boolean;
  wind: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const scene = useThree((state) => state.scene);
  const raster = useSyncExternalStore(heights.subscribe, heights.snapshot, noRaster);
  const planet = useMemo(() => countryPlanet(plot, surveyGrade(plot, raster)), [plot, raster]);
  const geometry = useMemo(
    () => planetGeometry(planet, plot.surveyScale),
    [planet, plot.surveyScale],
  );
  const layout = useMemo(() => gardenLayout(plot, planet), [plot, planet]);
  const cover = useMemo(() => plantingMask(plot, layout, planet.radius), [plot, layout, planet]);
  useLayoutEffect(() => {
    if (!mesh.current || !geometry.boundingSphere) return;
    mesh.current.updateWorldMatrix(true, false);
    const bounds = geometry.boundingSphere.clone();
    // Include the crowns growing above the terrain in every direction.
    let canopy = 0;
    for (const trees of [layout.trees, layout.distant, layout.firs])
      for (const tree of trees) canopy = Math.max(canopy, tree.size * Math.max(1, tree.width));
    bounds.radius += canopy;
    countryOrbitBounds.set(scene, bounds.applyMatrix4(mesh.current.matrixWorld));
    return () => {
      countryOrbitBounds.delete(scene);
    };
  }, [geometry, layout, scene]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => cover.texture.dispose(), [cover]);
  return (
    <>
      <mesh ref={mesh} name="country-ground" geometry={geometry} receiveShadow raycast={() => {}}>
        <CountryTurf
          color={plot.groundColor}
          plot={plot}
          shade={raster}
          cover={cover}
          daylight={daylight}
        />
      </mesh>
      <GardenPlanting
        assets={planting}
        layout={layout}
        shelterAt={cover.shelterAt}
        planet={planet}
        walkMode={walkMode}
        wind={wind}
        daylight={daylight}
      />
    </>
  );
}
