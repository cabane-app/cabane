import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, type Texture } from "three";
import { scan } from "../scanned-finishes";
import heightsUrl from "./assets/pasture-heights.png?url";
import hillsUrl from "./assets/valley-heights.png?url";
import { CountryTurf } from "./CountryTurf";
import { surveyGeometry, type FieldPlot } from "./country-survey";

const clamp = (texture: Texture) => {
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
};
const heights = [scan(heightsUrl, 1, NoColorSpace, clamp), scan(hillsUrl, 1, NoColorSpace, clamp)];
export const localHeights = heights[0];
const none = () => null;

export function CountryGround({
  plot,
  distant = false,
  daylight,
}: {
  plot: FieldPlot;
  distant?: boolean;
  daylight: number;
}) {
  const heightSource = heights[distant ? 1 : 0];
  const raster = useSyncExternalStore(heightSource.subscribe, heightSource.snapshot, none);
  const land = useMemo(
    () => (raster ? surveyGeometry(plot, raster, distant) : null),
    [plot, raster, distant],
  );
  useEffect(() => () => land?.dispose(), [land]);
  return (
    land && (
      <mesh
        name={distant ? "country-valley" : "country-ground"}
        geometry={land}
        receiveShadow={!distant}
        frustumCulled={false}
        raycast={() => {}}
      >
        <CountryTurf
          color={plot.groundColor}
          plot={plot}
          shade={distant ? undefined : raster}
          distant={distant}
          daylight={daylight}
        />
      </mesh>
    )
  );
}
