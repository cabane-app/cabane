import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { Color, Object3D, type DirectionalLight, type HemisphereLight } from "three";
import { solarShadowFrame } from "../../solar-shadow-frame";
import type { HomeManifest } from "../../types";

const DAY = {
  sky: new Color("#c8d8dd"),
  ambient: new Color("#fff5e8"),
  ground: new Color("#b2ad91"),
  sun: new Color("#fff0da"),
  ambientIntensity: 1.45,
  sunIntensity: 2.65,
};

const TWILIGHT = {
  sky: new Color("#c58e81"),
  ambient: new Color("#e2bcad"),
  ground: new Color("#b09a8e"),
  sun: new Color("#ffb476"),
  ambientIntensity: 0.85,
  sunIntensity: 1.15,
};

const NIGHT = {
  sky: new Color("#121d31"),
  ambient: new Color("#93aad9"),
  ground: new Color("#777f9c"),
  sun: new Color("#a8bcf4"),
  ambientIntensity: 0.32,
  sunIntensity: 0.09,
};

/** Keep the shadow angle fixed as the welcome tour passes through twilight. */
export function WelcomeLighting({
  floors,
  walk,
  daylightRef,
}: {
  floors: HomeManifest["floors"];
  walk: boolean;
  daylightRef: RefObject<number>;
}) {
  const sky = useRef<Color>(null);
  const ambient = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const last = useRef({ daylight: -1, walk });
  const { target, position, radius, far } = useMemo(() => {
    const frame = solarShadowFrame(floors);
    const target = new Object3D();
    target.position.set(...frame.center);
    const position = target.position
      .clone()
      .addScaledVector(target.position.clone().set(-0.55, 0.75, 0.37).normalize(), frame.distance);
    return { target, position, radius: frame.radius, far: frame.far };
  }, [floors]);

  useFrame(({ gl }) => {
    const daylight = daylightRef.current;
    if (
      !ambient.current ||
      !sun.current ||
      (last.current.daylight === daylight && last.current.walk === walk)
    )
      return;
    last.current = { daylight, walk };
    const from = daylight < 0.5 ? NIGHT : TWILIGHT;
    const to = daylight < 0.5 ? TWILIGHT : DAY;
    const blend = daylight < 0.5 ? daylight * 2 : daylight * 2 - 1;

    sky.current?.lerpColors(from.sky, to.sky, blend);
    ambient.current.color.lerpColors(from.ambient, to.ambient, blend);
    ambient.current.groundColor.lerpColors(from.ground, to.ground, blend);
    ambient.current.intensity =
      from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * blend;
    sun.current.color.lerpColors(from.sun, to.sun, blend);
    sun.current.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * blend;
    gl.domElement.style.setProperty("--welcome-nightfall", String(1 - daylight));
  });

  return (
    <>
      {walk && <color ref={sky} attach="background" args={[DAY.sky]} />}
      <hemisphereLight ref={ambient} args={[DAY.ambient, DAY.ground, DAY.ambientIntensity]} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        castShadow
        target={target}
        position={position}
        color={DAY.sun}
        intensity={DAY.sunIntensity}
        shadow-intensity={0.78}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-radius}
        shadow-camera-right={radius}
        shadow-camera-top={radius}
        shadow-camera-bottom={-radius}
        shadow-camera-near={1}
        shadow-camera-far={far}
        shadow-normalBias={0.014}
      />
    </>
  );
}
