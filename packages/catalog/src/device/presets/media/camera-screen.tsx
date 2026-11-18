import { useFrame, useThree } from "@react-three/fiber";
import {
  LiveCameraSurface,
  RoundedBox,
  ToonMaterial,
  type HomeDeviceModelProps,
} from "@cabane/engine";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { CameraProjector } from "./camera-projector";
import { CameraReticle } from "./camera-reticle";
import {
  CAMERA_SCREEN_ANIMATION_FPS,
  CAMERA_SCREEN_DEPTH,
  CAMERA_SCREEN_FLOAT_GAP,
  CAMERA_SCREEN_GLASS_OPACITY,
  CAMERA_SCREEN_HEIGHT,
  CAMERA_SCREEN_VIDEO_OPACITY,
  CAMERA_SCREEN_VISUAL_WIDTH,
  CAMERA_SCREEN_WIDTH,
  cameraScreenPose,
} from "./camera-screen-display";

const VIDEO_WIDTH = 0.78;
const VIDEO_HEIGHT = (VIDEO_WIDTH * 9) / 16;
const PANEL_CENTER_Y = 0.31;
const PANEL_CENTER_Z = CAMERA_SCREEN_FLOAT_GAP + CAMERA_SCREEN_DEPTH / 2;
const FRAME_Z = CAMERA_SCREEN_DEPTH / 2;
const VIDEO_Z = FRAME_Z + 0.003;
const HUD_Z = VIDEO_Z + 0.0015;

export function CameraScreenModel({ liveMedia, visualState, reducedMotion }: HomeDeviceModelProps) {
  const displayRef = useRef<Group>(null);
  const { invalidate } = useThree();
  const online = liveMedia?.state === "playing";
  const connecting = liveMedia?.state === "connecting";
  const corsBlocked = liveMedia?.previewState === "cors-blocked";
  const statusColor =
    online && !corsBlocked
      ? "#9afff6"
      : connecting
        ? "#f3b562"
        : corsBlocked
          ? "#f0a56a"
          : "#6f958f";

  useEffect(() => {
    if (reducedMotion) return undefined;
    const interval = globalThis.setInterval(
      () => invalidate(),
      1_000 / CAMERA_SCREEN_ANIMATION_FPS,
    );
    return () => globalThis.clearInterval(interval);
  }, [invalidate, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) return;
    displayRef.current?.position.set(0, 0, PANEL_CENTER_Z);
    invalidate();
  }, [invalidate, reducedMotion]);

  useFrame(({ clock }) => {
    if (!displayRef.current) return;
    const pose = cameraScreenPose(clock.elapsedTime, reducedMotion);
    displayRef.current.position.set(0, pose.verticalOffset, PANEL_CENTER_Z + pose.normalOffset);
  });

  return (
    <group name="catalog-camera-screen">
      <group name={`device-state-${visualState}`}>
        <CameraProjector />
        <mesh position={[0, PANEL_CENTER_Y, -0.001]} renderOrder={2}>
          <planeGeometry args={[CAMERA_SCREEN_VISUAL_WIDTH, 0.62]} />
          <ToonMaterial
            color="#65d8ce"
            emissive="#2e9e98"
            emissiveIntensity={0.38}
            transparent
            opacity={0.045}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <group ref={displayRef} position={[0, 0, PANEL_CENTER_Z]}>
          <RoundedBox
            args={[CAMERA_SCREEN_WIDTH, CAMERA_SCREEN_HEIGHT, CAMERA_SCREEN_DEPTH]}
            radius={0.005}
            smoothness={2}
            position={[0, PANEL_CENTER_Y, 0]}
            renderOrder={5}
          >
            <ToonMaterial
              color="#64cfc7"
              emissive="#298f8a"
              emissiveIntensity={0.4}
              transparent
              opacity={CAMERA_SCREEN_GLASS_OPACITY}
              depthWrite={false}
              toneMapped={false}
            />
          </RoundedBox>

          <RoundedBox
            args={[VIDEO_WIDTH + 0.028, VIDEO_HEIGHT + 0.028, 0.004]}
            radius={0.0018}
            smoothness={1}
            position={[0, PANEL_CENTER_Y, FRAME_Z]}
            renderOrder={7}
          >
            <ToonMaterial
              color="#45beb7"
              emissive="#278d88"
              emissiveIntensity={0.52}
              transparent
              opacity={0.045}
              depthWrite={false}
              toneMapped={false}
            />
          </RoundedBox>

          <group position={[0, PANEL_CENTER_Y, VIDEO_Z]}>
            <LiveCameraSurface
              media={liveMedia}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              opacity={CAMERA_SCREEN_VIDEO_OPACITY}
            />
          </group>

          <group name="camera-screen-holographic-reticle" position={[0, PANEL_CENTER_Y, 0]}>
            <CameraReticle z={HUD_Z} />
          </group>

          <mesh position={[-0.19, PANEL_CENTER_Y + 0.253, HUD_Z]} renderOrder={12}>
            <boxGeometry args={[0.16, 0.003, 0.002]} />
            <ToonMaterial
              color="#b6eee8"
              emissive="#47bdb5"
              emissiveIntensity={0.9}
              transparent
              opacity={0.58}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          <mesh position={[0.425, PANEL_CENTER_Y - 0.247, HUD_Z + 0.0008]} renderOrder={13}>
            <ringGeometry args={[0.012, 0.014, 32]} />
            <ToonMaterial
              color={statusColor}
              emissive={statusColor}
              emissiveIntensity={online || connecting ? 1.2 : 0.38}
              transparent
              opacity={0.92}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
