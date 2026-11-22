import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, type Mesh, type Texture } from "three";
import { useThree } from "@react-three/fiber";
import { countryOrbitBounds } from "./landscape-frame";
import { scan } from "../scanned-finishes";
import heightsUrl from "./assets/pasture-heights.png?url";
import { GardenPlanting } from "./GardenPlanting";
import { gardenLayout } from "./garden-layout";
import { plantingMask } from "./planting-mask";
import { CountryTurf } from "./CountryTurf";
import { surveyGrade, type FieldPlot } from "./country-survey";
import { countryPlanet, planetGeometry } from "./country-planet";

const heights = scan(heightsUrl, 1, NoColorSpace, (texture: Texture) => {
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
});
const none = () => null;

export function CountryGround({
  plot,
  daylight,
  wind,
}: {
  plot: FieldPlot;
  daylight: number;
  wind: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const scene = useThree((state) => state.scene);
  const raster = useSyncExternalStore(heights.subscribe, heights.snapshot, none);
  const planet = useMemo(
    () => raster && countryPlanet(plot, surveyGrade(plot, raster)),
    [plot, raster],
  );
  const geometry = useMemo(
    () => planet && planetGeometry(planet, plot.surveyScale),
    [planet, plot.surveyScale],
  );
  const layout = useMemo(() => planet && gardenLayout(plot, planet), [plot, planet]);
  const cover = useMemo(
    () => layout && planet && plantingMask(plot, layout, planet.radius),
    [plot, layout, planet],
  );
  useLayoutEffect(() => {
    if (!mesh.current || !geometry?.boundingSphere || !layout) return;
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
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => cover?.texture.dispose(), [cover]);
  return planet && geometry && layout && cover ? (
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
        layout={layout}
        shelterAt={cover.shelterAt}
        planet={planet}
        wind={wind}
        daylight={daylight}
      />
    </>
  ) : null;
}
