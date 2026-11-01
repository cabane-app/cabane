import { SceneActivityPulse, ToonMaterial } from "@cabane/engine";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Group, Quaternion, Vector3 } from "three";
import { ElectricArc } from "./ElectricArc";
import { ElectricScorch } from "./ElectricScorch";
import { sampleLaserPulse } from "./laser-pulse";

export interface ShotVisual {
  id: number;
  start: Vector3;
  end: Vector3;
  hit: boolean;
  normal?: Vector3;
  createdAt?: number;
  color?: string;
  scorch?: boolean;
}
const noRaycast = () => undefined;

export function LaserShot({ shot }: { shot: ShotVisual }) {
  const pulse = useRef<Group>(null);
  const age = useRef(0);
  const path = useMemo(() => {
    const direction = shot.end.clone().sub(shot.start);
    const distance = direction.length();
    direction.normalize();
    return {
      distance,
      direction,
      rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction),
    };
  }, [shot]);
  useFrame((_, delta) => {
    age.current += delta;
    const sample = sampleLaserPulse(path.distance, age.current);
    if (pulse.current) {
      pulse.current.visible = sample.traveling;
      pulse.current.position
        .copy(shot.start)
        .addScaledVector(path.direction, (sample.head + sample.tail) / 2);
      pulse.current.scale.set(1, 1, Math.max(0.001, sample.head - sample.tail));
    }

  });
  const surfaceRotation = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    shot.normal ?? path.direction.clone().negate(),
  );
  const surfacePoint = shot.end
    .clone()
    .addScaledVector(shot.normal ?? path.direction.clone().negate(), 0.004);
  return (
    <group userData={{ walkToolVisual: true }}>
      <ElectricArc start={shot.start} end={shot.end} duration={0.3} color={shot.color} />
      {shot.hit && shot.scorch !== false && (
        <group position={surfacePoint.toArray()} quaternion={surfaceRotation.toArray()}>
          <ElectricScorch delay={0} lifetime={3.2} />
        </group>
      )}
      <group name="laser-pulse" ref={pulse} quaternion={path.rotation.toArray()} visible={false}>
        <mesh raycast={noRaycast} scale={[0.02, 0.02, 0.5]}>
          <sphereGeometry args={[1, 8, 6]} />
          <ToonMaterial
            color="#f5ffff"
            emissive={shot.color ?? "#caffff"}
            emissiveIntensity={4}
            toneMapped={false}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh raycast={noRaycast} scale={[0.06, 0.06, 0.55]}>
          <sphereGeometry args={[1, 8, 6]} />
          <ToonMaterial
            color={shot.color ?? "#41dfff"}
            emissive={shot.color ?? "#41dfff"}
            emissiveIntensity={2}
            toneMapped={false}
            transparent
            opacity={0.22}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      {shot.hit && (
        <group position={surfacePoint.toArray()} quaternion={surfaceRotation.toArray()}>
          <SceneActivityPulse
            color={shot.color}
            delay={sampleLaserPulse(path.distance, 0).travelSeconds}
          />
        </group>
      )}
    </group>
  );
}
