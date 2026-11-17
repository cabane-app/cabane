import { RoundedBox, type WalkToolProps } from "@cabane/engine";
import { BlasterGlove } from "@cabane/walk-laser";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, PerspectiveCamera, Scene } from "three";

import TorchlightModel from "./TorchlightModel";

export default function Torchlight({ enabled }: WalkToolProps) {
  const camera = useThree((state) => state.camera);
  const overlay = useMemo(() => new Scene(), []);
  const grip = useRef<Group>(null);

  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera) || !grip.current) return;
    const height = 1.2 * Math.tan((camera.fov * Math.PI) / 360);
    const width = height * camera.aspect;
    const model = grip.current;
    model.scale.setScalar(Math.min(1, width * 1.5));
    model.position.set(width * 0.29, -height * 0.27, -0.6);
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
        <group position={[0, 0.082, -0.07]} rotation={[0, 0.46, -0.05]} scale={0.77}>
          <group position={[0, 0.026, 0.021]}>
            <TorchlightModel />
          </group>
          {/* A raked handle seats the flashlight above the glove's closed grasp. */}
          <group position={[0, -0.128, 0.145]} rotation={[-0.34, 0, 0]}>
            <RoundedBox args={[0.079, 0.24, 0.074]} radius={0.016}>
              <meshStandardMaterial color="#384659" />
            </RoundedBox>
            <RoundedBox args={[0.087, 0.023, 0.082]} radius={0.008} position={[0, -0.115, 0]}>
              <meshStandardMaterial color="#eda83e" />
            </RoundedBox>
          </group>
          <BlasterGlove />
        </group>
      </group>
    </>,
    overlay,
  );
}
