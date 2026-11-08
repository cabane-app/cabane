import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { deriveFloorLevels } from "../../building/floor-levels";
import {
  collectSceneWalkColliders,
  observeSceneWalkColliders,
} from "../../navigation/scene-walk-colliders";
import type { HomeManifest, RenderableFloorSpec } from "../../types";
import { usePreviewPlayback } from "./usePreviewPlayback";
import { createWelcomeWalkLoop, sampleWelcomeWalkLoop } from "./welcome-walk-loop";

export function WelcomeWalkCamera({
  loop,
  manifest,
  floor,
  playing,
  onUnavailable,
  advance,
}: {
  loop: NonNullable<ReturnType<typeof createWelcomeWalkLoop>>;
  manifest: HomeManifest;
  floor: RenderableFloorSpec;
  playing: boolean;
  onUnavailable: () => void;
  advance: (seconds: number) => number;
}) {
  const camera = useRef<ThreePerspectiveCamera>(null);
  const elapsed = useRef(0);
  const look = useRef({ yaw: 0, pitch: 0 });
  const { scene, gl, invalidate } = useThree();
  useEffect(() => {
    const elevation = deriveFloorLevels(manifest.floors).find(
      (level) => level.floorId === floor.id,
    );
    if (!elevation) return;
    const validate = () => {
      const colliders = collectSceneWalkColliders(scene, elevation.elevationMeters);
      if (!createWelcomeWalkLoop(manifest, floor, colliders)) onUnavailable();
    };
    const removeObserver = observeSceneWalkColliders(scene, validate);
    validate();
    return removeObserver;
  }, [floor, manifest, onUnavailable, scene]);

  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: { id: number; x: number; y: number } | null = null;
    const start = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (pointer?.id !== event.pointerId) return;
      look.current.yaw -= (event.clientX - pointer.x) * 0.004;
      look.current.pitch = Math.max(
        -1.1,
        Math.min(1.1, look.current.pitch - (event.clientY - pointer.y) * 0.004),
      );
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      invalidate();
    };
    const end = (event: PointerEvent) => {
      if (pointer?.id === event.pointerId) pointer = null;
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("lostpointercapture", end);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("lostpointercapture", end);
    };
  }, [gl, invalidate]);

  usePreviewPlayback(playing, (seconds) => {
    elapsed.current = advance(seconds);
    const settle = Math.exp(-seconds * 4);
    look.current.yaw *= settle;
    look.current.pitch *= settle;
  });
  useFrame(() => {
    if (!camera.current) return;
    const pose = sampleWelcomeWalkLoop(loop, elapsed.current);
    camera.current.position.set(...pose.position);
    camera.current.rotation.set(
      pose.pitch + look.current.pitch,
      pose.yaw + look.current.yaw,
      0,
      "YXZ",
    );
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={62} near={0.055} far={250} />;
}
