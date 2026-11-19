import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, type Texture } from "three";
import { scan } from "../scanned-finishes";
import heightsUrl from "./assets/pasture-heights.png?url";
import hillsUrl from "./assets/valley-heights.png?url";
import { GardenPlanting } from "./GardenPlanting";
import { gardenLayout } from "./garden-layout";
import { plantingMask } from "./planting-mask";
import { CountryTurf } from "./CountryTurf";
import { surveyGeometry, type FieldPlot } from "./country-survey";

const clamp = (texture: Texture) => {
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
};
const heights = [scan(heightsUrl, 1, NoColorSpace, clamp), scan(hillsUrl, 1, NoColorSpace, clamp)];
const localHeights = heights[0];
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
  const layout = useMemo(() => gardenLayout(plot), [plot]);
  const cover = useMemo(() => plantingMask(plot, layout), [plot, layout]);
  useEffect(() => () => cover.texture.dispose(), [cover]);
  const nearRaster = useSyncExternalStore(localHeights.subscribe, localHeights.snapshot, none);
  const farRaster = useSyncExternalStore(heights[1].subscribe, heights[1].snapshot, none);
  const near = useMemo(
    () => (nearRaster ? surveyGeometry(plot, nearRaster, false) : null),
    [plot, nearRaster],
  );
  const far = useMemo(
    () => (farRaster ? surveyGeometry(plot, farRaster, true) : null),
    [plot, farRaster],
  );
  useEffect(() => () => near?.dispose(), [near]);
  useEffect(() => () => far?.dispose(), [far]);
  return (
    <>
      {near && (
        <mesh
          name="country-ground"
          geometry={near}
          receiveShadow
          frustumCulled={false}
          raycast={() => {}}
        >
          <CountryTurf
            color={plot.groundColor}
            plot={plot}
            shade={nearRaster}
            cover={cover}
            daylight={daylight}
          />
        </mesh>
      )}
      {far && (
        <mesh name="country-valley" geometry={far} frustumCulled={false} raycast={() => {}}>
          <CountryTurf color={plot.groundColor} plot={plot} distant daylight={daylight} />
        </mesh>
      )}
      {near && far && (
        <GardenPlanting
          layout={layout}
          shelterAt={cover.shelterAt}
          near={near}
          far={far}
          wind={wind}
          daylight={daylight}
        />
      )}
    </>
  );
}
