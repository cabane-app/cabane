import { useMemo } from "react";
import { Object3D } from "three";
import { solarShadowFrame } from "../../solar-shadow-frame";
import type { HomeManifest } from "../../types";

/** Fixed afternoon light for the welcome stage. The dashboard follows its own lighting settings. */
export function WelcomeLighting({
  floors,
  walk,
}: {
  floors: HomeManifest["floors"];
  walk: boolean;
}) {
  const { target, position, radius, far } = useMemo(() => {
    const frame = solarShadowFrame(floors);
    const target = new Object3D();
    target.position.set(...frame.center);
    const position = target.position
      .clone()
      .addScaledVector(target.position.clone().set(-0.55, 0.75, 0.37).normalize(), frame.distance);
    return { target, position, radius: frame.radius, far: frame.far };
  }, [floors]);
  return (
    <>
      {walk && <color attach="background" args={["#c8d8dd"]} />}
      <hemisphereLight args={["#fff5e8", "#b2ad91", 1.45]} />
      <primitive object={target} />
      <directionalLight
        castShadow
        target={target}
        position={position}
        color="#fff0da"
        intensity={2.65}
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
