import type { WalkToolProps } from "@cabane/engine";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Object3D, PerspectiveCamera, Scene, SpotLight } from "three";

export default function Torchlight({ enabled }: WalkToolProps) {
  const camera = useThree((state) => state.camera);
  const overlay = useMemo(() => new Scene(), []);
  const target = useMemo(() => new Object3D(), []);
  const grip = useRef<Group>(null);
  const beam = useRef<SpotLight>(null);

  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera) || !grip.current || !beam.current) return;
    const height = 1.2 * Math.tan((camera.fov * Math.PI) / 360);
    const width = height * camera.aspect;
    const model = grip.current;
    model.scale.setScalar(Math.min(1, width * 1.5));
    model.position.set(width * 0.29, -height * 0.27, -0.6);
    model.position.applyQuaternion(camera.quaternion).add(camera.position);
    model.quaternion.copy(camera.quaternion);
    beam.current.position.copy(model.position);
    target.position.set(0, 0, -6).applyQuaternion(camera.quaternion).add(camera.position);
    target.updateMatrixWorld();
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

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={beam}
        target={target}
        visible={enabled}
        color="#fff1d4"
        intensity={48}
        distance={18}
        angle={0.36}
        penumbra={0.65}
      />
      {createPortal(
        <>
          <ambientLight intensity={1.4} />
          <directionalLight position={[-2, 4, 1]} intensity={2} />
          <group ref={grip}>
            <group rotation={[-Math.PI / 2 + 0.17, 0, -0.28]}>
              <mesh>
                <cylinderGeometry args={[0.052, 0.049, 0.29, 16]} />
                <meshStandardMaterial color="#383042" />
              </mesh>
              <mesh position={[0, 0.13, 0]}>
                <cylinderGeometry args={[0.087, 0.052, 0.09, 16]} />
                <meshStandardMaterial color="#e6af48" />
              </mesh>
              <mesh position={[0, 0.183, 0]}>
                <cylinderGeometry args={[0.088, 0.088, 0.025, 16]} />
                <meshStandardMaterial color="#463a49" />
              </mesh>
              <mesh position={[0, 0.198, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.009, 16]} />
                <meshBasicMaterial color="#fff0bc" />
              </mesh>
              <mesh position={[0, 0.015, 0.051]}>
                <boxGeometry args={[0.031, 0.046, 0.012]} />
                <meshStandardMaterial color="#edb94f" />
              </mesh>
            </group>
          </group>
        </>,
        overlay,
      )}
    </>
  );
}
