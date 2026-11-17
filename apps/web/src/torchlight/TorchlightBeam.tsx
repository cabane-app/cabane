import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Object3D, PerspectiveCamera, type SpotLight } from "three";

export function TorchlightBeam({ active }: { active: boolean }) {
  const target = useMemo(() => new Object3D(), []);
  const beam = useRef<SpotLight>(null);
  useFrame(({ camera }) => {
    if (!active || !beam.current || !(camera instanceof PerspectiveCamera)) return;
    const height = 1.2 * Math.tan((camera.fov * Math.PI) / 360);
    beam.current.position
      .set(height * camera.aspect * 0.29, -height * 0.27, -0.6)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    target.position.set(0, 0, -6).applyQuaternion(camera.quaternion).add(camera.position);
  });
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={beam}
        target={target}
        color="#fff1d4"
        intensity={active ? 48 : 0}
        distance={18}
        angle={0.36}
        penumbra={0.65}
      />
    </>
  );
}
