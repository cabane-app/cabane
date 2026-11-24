import { Suspense, useEffect, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { CountrySky } from "./CountrySky";
import { CountryGround } from "./CountryGround";
import { preloadGardenPlanting, useGardenPlantingAssets } from "./GardenPlanting";
import type { FieldPlot } from "./country-survey";
import { completePlanetScenes } from "./landscape-frame";
import { usePlanetScansReady } from "./planet-scans";

export function Countryside(props: {
  frame: FieldPlot;
  walkMode: boolean;
  daylight: number;
  overcast: number;
  reducedMotion: boolean;
}) {
  const ready = usePlanetScansReady();
  useEffect(preloadGardenPlanting, []);
  return ready ? (
    <Suspense fallback={null}>
      <Planet {...props} />
    </Suspense>
  ) : null;
}

function Planet({
  frame,
  walkMode,
  daylight,
  overcast,
  reducedMotion,
}: {
  frame: FieldPlot;
  walkMode: boolean;
  daylight: number;
  overcast: number;
  reducedMotion: boolean;
}) {
  const { scene, invalidate } = useThree();
  const planting = useGardenPlantingAssets();
  useLayoutEffect(() => {
    completePlanetScenes.add(scene);
    invalidate();
    return () => {
      completePlanetScenes.delete(scene);
    };
  }, [invalidate, scene]);
  return (
    <group name="landscape-countryside" position={[frame.surveyX, frame.y, frame.surveyZ]}>
      <CountrySky plot={frame} daylight={daylight} overcast={overcast} orbit={!walkMode} />
      <CountryGround
        planting={planting}
        plot={frame}
        daylight={daylight}
        walkMode={walkMode}
        wind={walkMode && !reducedMotion}
      />
    </group>
  );
}
