import { LiveCameraSurface, Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps, SceneItemSize } from "@cabane/engine";
import { TelevisionPicture } from "../television-picture";
import { TripodStand } from "./tripod-stand";

export const TRIPOD_TELEVISION_SIZE: SceneItemSize = [1.1, 0.75, 0.4];

const SCREEN_COLORS = {
  "connected-active": "#6f9aa3",
  "connected-inactive": "#1f2b29",
  unavailable: "#806852",
  disconnected: "#465450",
};

export function TripodTelevisionModel({
  visualState,
  liveMedia,
  reducedMotion,
}: HomeDeviceModelProps) {
  return (
    <group name="catalog-tripod-television">
      <TripodStand />
      <RoundedBox
        position={[0, 0.435, 0.04]}
        args={[1.1, 0.63, 0.06]}
        radius={0.018}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#28312f" />
        <Outlines color="#1e2724" thickness={0.0015} screenspace={false} />
      </RoundedBox>
      <mesh position={[0, 0.44, 0.075]}>
        <boxGeometry args={[1.04, 0.575, 0.01]} />
        <ToonMaterial color={SCREEN_COLORS[visualState]} />
      </mesh>
      <group userData={{ modelGlowIgnore: true }} position={[0, 0.44, 0.084]}>
        {liveMedia ? (
          <LiveCameraSurface media={liveMedia} width={1.04} height={0.575} opacity={1} />
        ) : visualState === "connected-active" ? (
          <TelevisionPicture width={1.04} height={0.575} reducedMotion={reducedMotion} />
        ) : (
          <mesh position={[-0.33, 0.16, 0]} rotation={[0, 0, -0.1]}>
            <planeGeometry args={[0.35, 0.014]} />
            <ToonMaterial color="#a9bbb4" transparent opacity={0.25} />
          </mesh>
        )}
      </group>
      <mesh position={[0.46, 0.138, 0.074]}>
        <boxGeometry args={[0.018, 0.005, 0.004]} />
        <ToonMaterial color={visualState === "connected-active" ? "#a6c8ad" : "#77847a"} />
      </mesh>
    </group>
  );
}
