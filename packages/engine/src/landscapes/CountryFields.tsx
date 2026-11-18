import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, SRGBColorSpace, type Texture } from "three";
import { scan } from "../scanned-finishes";
import fieldsUrl from "./assets/pastures.webp?url";
import heightsUrl from "./assets/pasture-heights.png?url";
import valleyUrl from "./assets/valley.webp?url";
import hillsUrl from "./assets/valley-heights.png?url";
import { CountryTurf } from "./CountryTurf";
import { surveyGeometry, type FieldPlot } from "./country-survey";

const clamp = (texture: Texture) => {
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
};
const imagery = [
  scan(fieldsUrl, 1, SRGBColorSpace, clamp),
  scan(valleyUrl, 1, SRGBColorSpace, clamp),
];
const heights = [scan(heightsUrl, 1, NoColorSpace, clamp), scan(hillsUrl, 1, NoColorSpace, clamp)];
export const localHeights = heights[0];
const none = () => null;

export function CountryFields({
  plot,
  distant = false,
  daylight,
}: {
  plot: FieldPlot;
  distant?: boolean;
  daylight: number;
}) {
  const index = distant ? 1 : 0,
    photoSource = imagery[index],
    heightSource = heights[index];
  const photo = useSyncExternalStore(photoSource.subscribe, photoSource.snapshot, none);
  const raster = useSyncExternalStore(heightSource.subscribe, heightSource.snapshot, none);
  const land = useMemo(
    () => (raster ? surveyGeometry(plot, raster, distant) : null),
    [plot, raster, distant],
  );
  useEffect(() => () => land?.dispose(), [land]);
  return (
    land &&
    photo && (
      <mesh
        name={distant ? "country-valley" : "country-pasture"}
        geometry={land}
        receiveShadow={!distant}
        frustumCulled={false}
        raycast={() => {}}
      >
        <CountryTurf
          color={plot.groundColor}
          plot={plot}
          survey={photo}
          distant={distant}
          daylight={daylight}
        />
      </mesh>
    )
  );
}
