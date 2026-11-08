import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { deriveFloorLevels } from "../../building/floor-levels";
import {
  collectSceneWalkColliders,
  observeSceneWalkColliders,
} from "../../navigation/scene-walk-colliders";
import { clampPitch } from "../../navigation/walk-motion";
import type { StickVector, WalkPoint } from "../../navigation/walk-navigation-contract";
import type { HomeManifest, RenderableFloorSpec } from "../../types";
import { usePreviewPlayback } from "./usePreviewPlayback";
import { bindWelcomeWalkInput } from "./welcome-walk-input";
import { createWelcomeWalkLoop, sampleWelcomeWalkLoop } from "./welcome-walk-loop";
import { createWelcomeWalkNavigation } from "./welcome-walk-navigation";

export function WelcomeWalkCamera({
  loop,
  manifest,
  floor,
  playing,
  onUnavailable,
  onManualInput,
  advance,
}: {
  loop: NonNullable<ReturnType<typeof createWelcomeWalkLoop>>;
  manifest: HomeManifest;
  floor: RenderableFloorSpec;
  playing: boolean;
  onUnavailable: () => void;
  onManualInput?: () => void;
  advance: (seconds: number) => number;
}) {
  const camera = useRef<ThreePerspectiveCamera>(null);
  const elapsed = useRef(0);
  const look = useRef({ yaw: 0, pitch: 0 });
  const movement = useRef<StickVector>({ x: 0, y: 0 });
  const manualPosition = useRef<WalkPoint | null>(null);
  const navigation = useRef<ReturnType<typeof createWelcomeWalkNavigation>>(null);
  const { scene, gl, invalidate } = useThree();

  useEffect(() => {
    const elevation = deriveFloorLevels(manifest.floors).find(
      (level) => level.floorId === floor.id,
    );
    if (!elevation) return;
    const validate = () => {
      const colliders = collectSceneWalkColliders(scene, elevation.elevationMeters);
      navigation.current = createWelcomeWalkNavigation(manifest, floor, colliders);
      if (!createWelcomeWalkLoop(manifest, floor, colliders)) onUnavailable();
      if (manualPosition.current && !navigation.current?.isClear(manualPosition.current)) {
        manualPosition.current = null;
        invalidate();
      }
    };
    const removeObserver = observeSceneWalkColliders(scene, validate);
    validate();
    return removeObserver;
  }, [floor, invalidate, manifest, onUnavailable, scene]);

  useEffect(
    () =>
      bindWelcomeWalkInput(
        gl.domElement,
        (input) => {
          movement.current = input;
          if (input.x !== 0 || input.y !== 0) onManualInput?.();
          invalidate();
        },
        (dx, dy) => {
          look.current.yaw -= dx * 0.004;
          look.current.pitch = clampPitch(look.current.pitch - dy * 0.004);
          invalidate();
        },
      ),
    [gl, invalidate, onManualInput],
  );

  usePreviewPlayback(playing, (seconds) => {
    if (movement.current.x !== 0 || movement.current.y !== 0) return;
    manualPosition.current = null;
    elapsed.current = advance(seconds);
    const settle = Math.exp(-seconds * 4);
    look.current.yaw *= settle;
    look.current.pitch *= settle;
  });

  useFrame((_, delta) => {
    if (!camera.current) return;
    const pose = sampleWelcomeWalkLoop(loop, elapsed.current);
    const yaw = pose.yaw + look.current.yaw;
    const pitch = clampPitch(pose.pitch + look.current.pitch);
    const [x, y, z] = pose.position;
    const input = movement.current;
    if (navigation.current && (input.x !== 0 || input.y !== 0)) {
      manualPosition.current = navigation.current.move(
        manualPosition.current ?? { x, z },
        input,
        yaw,
        Math.min(0.05, delta),
      );
      invalidate();
    }
    camera.current.position.set(manualPosition.current?.x ?? x, y, manualPosition.current?.z ?? z);
    camera.current.rotation.set(pitch, yaw, 0, "YXZ");
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={62} near={0.055} far={250} />;
}
