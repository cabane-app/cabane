import { LiveCameraSurface, RoundedBox, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { TelevisionPicture } from "./television-picture";
import { TelevisionChassis, TelevisionFeet } from "./television-chassis";
import { StatusBeacon } from "../../visuals/device-visual-state";

const CHARCOAL = "#28312f";

const screenPalette = (visualState: HomeDeviceModelProps["visualState"]) => {
  switch (visualState) {
    case "connected-active":
      return { screen: "#6f9aa3", reflection: "#a9c1c3" };
    case "connected-inactive":
      return { screen: "#1f2b29", reflection: "#50615d" };
    case "unavailable":
      return { screen: "#806852", reflection: "#b49a7c" };
    case "disconnected":
      return { screen: "#465450", reflection: "#7b8b86" };
  }
};

function RoundedTvShell() {
  return (
    <group name="catalog-television-rounded-shell" position={[0, 0.524, 0]}>
      <RoundedBox
        userData={{ modelGlowKey: "tv.shell" }}
        args={[1.58, 0.852, 0.043]}
        radius={0.019}
        bevelSegments={2}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <ToonMaterial color={CHARCOAL} />
      </RoundedBox>
    </group>
  );
}

export function TelevisionModel({ visualState, liveMedia, reducedMotion }: HomeDeviceModelProps) {
  const palette = screenPalette(visualState);

  return (
    <group name="catalog-television">
      <RoundedTvShell />
      <TelevisionChassis />
      <mesh userData={{ modelGlowKey: "tv.screen" }} position={[0, 0.515, 0.036]} receiveShadow>
        <boxGeometry args={[1.405, 0.675, 0.014]} />
        <ToonMaterial color={palette.screen} />
      </mesh>
      {liveMedia ? (
        <group userData={{ modelGlowIgnore: true }} position={[0, 0.515, 0.047]}>
          <LiveCameraSurface media={liveMedia} width={1.405} height={0.675} opacity={1} />
        </group>
      ) : visualState === "connected-active" ? (
        <group userData={{ modelGlowIgnore: true }} position={[0, 0.515, 0.047]}>
          <TelevisionPicture width={1.405} height={0.675} reducedMotion={reducedMotion} />
        </group>
      ) : (
        <group userData={{ modelGlowIgnore: true }}>
          <mesh position={[-0.38, 0.69, 0.047]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.42, 0.018, 0.006]} />
            <ToonMaterial color={palette.reflection} transparent opacity={0.34} />
          </mesh>
          <mesh position={[-0.23, 0.62, 0.048]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.21, 0.009, 0.006]} />
            <ToonMaterial color={palette.reflection} transparent opacity={0.22} />
          </mesh>
        </group>
      )}
      <TelevisionFeet />
      <mesh userData={{ modelGlowKey: "tv.badge" }} position={[0, 0.131, 0.037]}>
        <boxGeometry args={[0.098, 0.016, 0.008]} />
        <ToonMaterial color="#222928" />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.65, 0.131, 0.038]} scale={0.7} />
    </group>
  );
}
