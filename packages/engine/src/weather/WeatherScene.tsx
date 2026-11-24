import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { solarShadowFrame } from "../solar-shadow-frame";
import type { RenderableFloorSpec } from "../types";
import type { RoofSettings } from "../roof/roof-settings";
import { CLEAR_WEATHER, type WeatherAppearance } from "./weather-appearance";
import { createWeatherShelter } from "./weather-shelter";
import { WeatherClouds } from "./WeatherClouds";
import { WeatherParticles } from "./WeatherParticles";
import { WeatherBackdrop } from "./WeatherBackdrop";
export interface WeatherFrame {
  appearance: WeatherAppearance;
  time: number;
  daylight: number;
}
export function WeatherScene({
  appearance,
  floors,
  roof,
  walkMode,
  reducedMotion,
  daylight,
  quality,
}: {
  appearance: WeatherAppearance;
  floors: readonly RenderableFloorSpec[];
  roof?: RoofSettings | undefined;
  walkMode: boolean;
  reducedMotion: boolean;
  daylight: number;
  quality: number;
}) {
  const hasClouds = appearance.clouds > 0;
  const [cloudsStarted, setCloudsStarted] = useState(hasClouds);
  // Clear weather needs no cloud sprite. Once started, keep the field mounted
  // so a later transition back to clear can fade out normally.
  if (hasClouds && !cloudsStarted) setCloudsStarted(true);
  const bounds = useMemo(() => solarShadowFrame(floors), [floors]);
  const center = useMemo(() => [bounds.center[0], bounds.center[2]] as const, [bounds]);
  const shelter = useMemo(() => createWeatherShelter(floors, roof), [floors, roof]);
  useEffect(() => () => shelter.texture.dispose(), [shelter]);
  const frame = useMemo<WeatherFrame>(
    () => ({ appearance: { ...CLEAR_WEATHER }, time: 0, daylight: 1 }),
    [],
  );
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  }, [appearance, daylight, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    const progress = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, delta) * 1.15);
    let difference = 0;
    for (const key of Object.keys(appearance) as (keyof WeatherAppearance)[]) {
      frame.appearance[key] += (appearance[key] - frame.appearance[key]) * progress;
      if (Math.abs(appearance[key] - frame.appearance[key]) < 0.001)
        frame.appearance[key] = appearance[key];
      difference += Math.abs(appearance[key] - frame.appearance[key]);
    }
    frame.daylight += (daylight - frame.daylight) * progress;
    const animated =
      !reducedMotion &&
      frame.appearance.clouds +
        frame.appearance.rain +
        frame.appearance.snow +
        frame.appearance.hail +
        frame.appearance.mist +
        frame.appearance.wind >
        0.005;
    if (animated) frame.time += Math.min(delta, 0.1);
    if (animated || difference > 0.001 || Math.abs(daylight - frame.daylight) > 0.001) invalidate();
  }, -2);
  const detailed = quality > 1.25;
  const counts = detailed
    ? [1800, 900, 800, 24, 36]
    : quality > 0.9
      ? [800, 450, 350, 16, 20]
      : [400, 220, 180, 8, 10];
  const span = walkMode ? 30 : Math.max(24, bounds.radius * 2.5);
  return (
    <group name="weather-atmosphere">
      <WeatherBackdrop frame={frame} reducedMotion={reducedMotion} />
      {cloudsStarted && (
        <WeatherClouds
          frame={frame}
          center={center}
          radius={Math.max(12, bounds.radius)}
          top={shelter.maxHeight + 5}
          detail={detailed}
          reducedMotion={reducedMotion}
          walkMode={walkMode}
        />
      )}
      {counts.map((count, kind) => (
        <WeatherParticles
          key={kind}
          frame={frame}
          shelter={shelter}
          kind={kind}
          count={count}
          center={center}
          span={span}
          walkMode={walkMode}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
