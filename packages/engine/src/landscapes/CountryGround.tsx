import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, type Texture } from "three";
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
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => cover?.texture.dispose(), [cover]);
  return planet && geometry && layout && cover ? (
    <>
      <mesh name="country-ground" geometry={geometry} receiveShadow raycast={() => {}}>
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
