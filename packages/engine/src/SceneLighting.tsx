import { useSceneStyle, styleSolarLighting } from "./scene-style";
import {
  CLEAR_WEATHER,
  weatherSolarLighting,
  type WeatherAppearance,
} from "./weather/weather-appearance";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Object3D, Vector3, type DirectionalLight, type HemisphereLight } from "three";
import { transitionSolarDirection } from "./solar-direction-transition";
import { WalkSky } from "./WalkSky";
import { deriveSolarLighting, type SolarLightingMode, type SunEntityState } from "./lighting";

import { solarShadowFrame } from "./solar-shadow-frame";
import type { RenderableFloorSpec } from "./types";

const EMPTY_FLOORS: readonly RenderableFloorSpec[] = [];
const TRANSITION_RATE = 4.5;
const EPSILON = 0.002;
const colorDifference = (left: Color, right: Color) =>
  Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g), Math.abs(left.b - right.b));

export function SolarLighting({
  weather = CLEAR_WEATHER,
  reducedMotion = false,
  mode,
  shadowMapSize,
  sunState,
  walkMode = false,
  northAngleDegrees = 0,
  floors = EMPTY_FLOORS,
}: {
  weather?: WeatherAppearance;
  reducedMotion?: boolean;
  mode: SolarLightingMode;
  shadowMapSize: 1024 | 2048;
  sunState?: SunEntityState;
  walkMode?: boolean;
  northAngleDegrees?: number;
  floors?: readonly RenderableFloorSpec[];
}) {
  const style = useSceneStyle();
  const solar = useMemo(
    () => deriveSolarLighting(sunState, mode, northAngleDegrees),
    [mode, sunState, northAngleDegrees],
  );
  const target = useMemo(
    () => styleSolarLighting(weatherSolarLighting(solar, weather), style),
    [solar, weather, style],
  );
  const frame = useMemo(() => solarShadowFrame(floors), [floors]);
  const lightTarget = useMemo(() => {
    const object = new Object3D();
    object.position.set(...frame.center);
    return object;
  }, [frame]);
  const initial = useRef(target);
  const sunRef = useRef<DirectionalLight>(null);
  const hemisphereRef = useRef<HemisphereLight>(null);
  const targetPosition = useMemo(
    () => new Vector3(...target.sunPosition).normalize().multiplyScalar(frame.distance),
    [target.sunPosition, frame.distance],
  );
  const targetSun = useMemo(() => new Color(target.sunColor), [target.sunColor]);
  const targetBackground = useMemo(
    () => new Color(target.backgroundColor),
    [target.backgroundColor],
  );
  const targetSky = useMemo(
    () => new Color(target.hemisphereSkyColor),
    [target.hemisphereSkyColor],
  );
  const targetGround = useMemo(
    () => new Color(target.hemisphereGroundColor),
    [target.hemisphereGroundColor],
  );
  const transitioning = useRef(false);
  const { invalidate, scene } = useThree();

  useEffect(() => {
    transitioning.current = true;
    invalidate();
  }, [invalidate, target, lightTarget]);
  useFrame((_, delta) => {
    const sun = sunRef.current;
    const hemisphere = hemisphereRef.current;
    if (!transitioning.current || !sun || !hemisphere) return;
    const background = scene.background instanceof Color ? scene.background : new Color();
    if (!(scene.background instanceof Color)) scene.background = background;
    const progress = reducedMotion
      ? 1
      : 1 - Math.exp(-(weather === CLEAR_WEATHER ? TRANSITION_RATE : 1.15) * delta);
    sun.position.sub(lightTarget.position);
    transitionSolarDirection(sun.position, targetPosition, progress);
    sun.position.add(lightTarget.position);
    sun.color.lerp(targetSun, progress);
    sun.intensity += (target.sunIntensity - sun.intensity) * progress;
    hemisphere.color.lerp(targetSky, progress);
    hemisphere.groundColor.lerp(targetGround, progress);
    hemisphere.intensity += (target.hemisphereIntensity - hemisphere.intensity) * progress;
    background.lerp(targetBackground, progress);
    const remaining = Math.max(
      sun.position.clone().sub(lightTarget.position).distanceTo(targetPosition) / frame.distance,
      colorDifference(sun.color, targetSun),
      Math.abs(sun.intensity - target.sunIntensity),
      colorDifference(hemisphere.color, targetSky),
      colorDifference(hemisphere.groundColor, targetGround),
      Math.abs(hemisphere.intensity - target.hemisphereIntensity),
      colorDifference(background, targetBackground),
    );
    if (remaining <= EPSILON) {
      sun.position.copy(targetPosition).add(lightTarget.position);
      sun.color.copy(targetSun);
      sun.intensity = target.sunIntensity;
      hemisphere.color.copy(targetSky);
      hemisphere.groundColor.copy(targetGround);
      hemisphere.intensity = target.hemisphereIntensity;
      background.copy(targetBackground);
      transitioning.current = false;
    } else invalidate();
  }, -1);
  return (
    <>
      {walkMode && (
        <WalkSky
          sunRef={sunRef}
          daylight={solar.daylight}
          overcast={weather.darkness}
          reducedMotion={reducedMotion}
        />
      )}
      <color attach="background" args={[initial.current.backgroundColor]} />
      <hemisphereLight
        ref={hemisphereRef}
        args={[
          initial.current.hemisphereSkyColor,
          initial.current.hemisphereGroundColor,
          initial.current.hemisphereIntensity,
        ]}
      />
      <primitive object={lightTarget} />
      <directionalLight
        key={shadowMapSize}
        ref={sunRef}
        castShadow
        target={lightTarget}
        position={new Vector3(...initial.current.sunPosition)
          .normalize()
          .multiplyScalar(frame.distance)
          .add(lightTarget.position)
          .toArray()}
        color={initial.current.sunColor}
        intensity={initial.current.sunIntensity}
        shadow-intensity={0.62}
        shadow-radius={2}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-frame.radius}
        shadow-camera-right={frame.radius}
        shadow-camera-top={frame.radius}
        shadow-camera-bottom={-frame.radius}
        shadow-camera-near={1}
        shadow-camera-far={frame.far}
        shadow-bias={-0.00005}
        shadow-normalBias={0.012}
      />
    </>
  );
}
