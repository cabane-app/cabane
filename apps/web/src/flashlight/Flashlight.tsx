import { type WalkToolProps } from "@cabane/engine";
import { BlasterGlove } from "@cabane/walk-laser";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, PerspectiveCamera, Scene } from "three";

import FlashlightModel from "./FlashlightModel";

export default function Flashlight({ enabled, reducedMotion }: WalkToolProps) {
  const camera = useThree((state) => state.camera);
  const overlay = useMemo(() => new Scene(), []);
  const grip = useRef<Group>(null);

  const motion = useMemo(
    () => ({ previous: camera.position.clone(), phase: 0, weight: 0 }),
    [camera],
  );
  useFrame((_, delta) => {
    if (!(camera instanceof PerspectiveCamera) || !grip.current) return;
    const height = 1.2 * Math.tan((camera.fov * Math.PI) / 360);
    const width = height * camera.aspect;
    const model = grip.current;
    model.scale.setScalar(Math.min(1, width * 1.5));
    const distance = Math.hypot(
      camera.position.x - motion.previous.x,
      camera.position.z - motion.previous.z,
    );
    motion.previous.copy(camera.position);
    const step = distance < 0.5 ? distance : 0;
    motion.phase += step * 4;
    motion.weight +=
      (Math.min(1, step / Math.max(delta, 0.001)) - motion.weight) * (1 - Math.exp(-12 * delta));
    const swing = reducedMotion ? 0 : motion.weight;
    model.position.set(
      width * 0.24 + Math.sin(motion.phase) * 0.012 * swing,
      -height * 0.21 + Math.cos(2 * motion.phase) * 0.008 * swing,
      -0.6,
    );
    model.position.applyQuaternion(camera.quaternion).add(camera.position);
    model.quaternion.copy(camera.quaternion);
  });

  useFrame(({ gl }) => {
    if (!enabled) return;
    const autoClear = gl.autoClear;
    try {
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(overlay, camera);
    } finally {
      gl.autoClear = autoClear;
    }
  }, 2);

  return createPortal(
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-2, 4, 3]} intensity={2.2} />
      <group ref={grip}>
        <group rotation={[0, 0.52, -0.06]}>
          <FlashlightModel />
          <BlasterGlove pose="flashlight" />
        </group>
      </group>
    </>,
    overlay,
  );
}
