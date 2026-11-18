import { CylinderGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { turnedProfile } from "../../visuals/turned-profile";
import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { VacuumTractorBeam } from "./vacuum-tractor-beam";
import { sampleVacuumFlight } from "./vacuum-flight-motion";
import { ActivityHologram } from "../../visuals/activity-hologram";
import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";

const hullShell = turnedProfile(
  [
    [0, 0.013],
    [0.145, 0.013],
    [0.168, 0.026],
    [0.171, 0.049],
    [0.174, 0.056],
    [0.175, 0.061],
    [0.169, 0.067],
    [0.157, 0.069],
  ],
  32,
);
const bumper = turnedProfile(
  [
    [0.167, 0.026],
    [0.173, 0.028],
    [0.173, 0.033],
    [0.173, 0.048],
    [0.171, 0.053],
    [0.168, 0.053],
  ],
  20,
  -Math.PI * 0.57,
  Math.PI * 1.14,
);
const lid = mergeGeometries([
  turnedProfile(
    [
      [0.159, 0.065],
      [0.158, 0.069],
      [0.148, 0.073],
      [0, 0.073],
    ],
    32,
  ),
  turnedProfile(
    [
      [0.043, 0.0845],
      [0.045, 0.086],
      [0.04, 0.089],
      [0.033, 0.09],
      [0.023, 0.09],
      [0.02, 0.088],
    ],
    20,
  ).translate(-0.045, 0, -0.025),
]);
const sensorWindow = turnedProfile(
  [
    [0.17, 0.031],
    [0.175, 0.034],
    [0.175, 0.047],
    [0.17, 0.05],
  ],
  12,
  -0.27,
  0.54,
);
const turret = turnedProfile(
  [
    [0.049, 0.072],
    [0.047, 0.077],
    [0.041, 0.078],
    [0.041, 0.083],
    [0.044, 0.084],
    [0.043, 0.088],
    [0.038, 0.087],
    [0, 0.087],
  ],
  20,
);
const wheels = mergeGeometries(
  [-0.118, 0.118].map((x) =>
    new CylinderGeometry(0.024, 0.024, 0.028, 12).rotateZ(Math.PI / 2).translate(x, 0.024, 0),
  ),
);

/** Generic circular robot vacuum; its forward sensor faces +Z. */
export function RobotVacuumModel({ visualState, reducedMotion, state }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  const flying = active && state?.state === "cleaning";
  const hull = useRef<Group>(null);
  const drift = useRef<Group>(null);
  const beam = useRef<Group>(null);
  const time = useRef(0);
  useLayoutEffect(() => {
    time.current = 0;
    if (drift.current) drift.current.position.set(0, 0, 0);
    if (hull.current) {
      hull.current.position.y = flying ? 1.5 : 0;
      hull.current.rotation.set(0, 0, 0);
    }
    if (beam.current) beam.current.scale.y = 1;
  }, [flying, reducedMotion]);
  useFrame(({ invalidate }, delta) => {
    if (!flying || reducedMotion || !hull.current) return;
    time.current += Math.min(delta, 0.05);
    const pose = sampleVacuumFlight(time.current);
    drift.current?.position.set(pose.x, 0, pose.z);
    hull.current.position.y = pose.height;
    hull.current.rotation.set(pose.pitch, pose.yaw, pose.roll);
    // Stretch from the floor so the beam follows the rising and falling hull.
    if (beam.current) beam.current.scale.y = pose.height / 1.5;
    invalidate();
  });
  return (
    <group ref={drift} name="catalog-robot-vacuum" userData={{ walkCollider: !flying }}>
      {flying && (
        <group ref={beam} name="vacuum-flight-beam">
          <VacuumTractorBeam reducedMotion={reducedMotion} />
        </group>
      )}
      <group
        ref={hull}
        name="vacuum-flight-hull"
        position={[0, flying ? 1.5 : 0, 0]}
        rotation={[0, 0, 0]}
      >
        <mesh geometry={hullShell} castShadow receiveShadow>
          <ToonMaterial color="#59635f" />
          <Outlines color="#38433e" thickness={0.001} screenspace={false} />
        </mesh>
        <mesh geometry={bumper}>
          <ToonMaterial color="#7d8782" />
        </mesh>
        <mesh geometry={lid}>
          <ToonMaterial color={palette.bodyDark} />
        </mesh>
        <mesh geometry={turret} name="robot-vacuum-lidar" position={[-0.045, 0, -0.025]}>
          <ToonMaterial color="#45524e" />
        </mesh>
        <mesh name="robot-vacuum-front-sensor" geometry={sensorWindow}>
          <ToonMaterial
            color="#24312f"
            emissive={active ? palette.paleBlue : "#24312f"}
            emissiveIntensity={active ? 0.3 : 0}
          />
        </mesh>
        <mesh geometry={wheels}>
          <ToonMaterial color="#2f3936" />
        </mesh>
        {!flying && (
          <ActivityHologram
            visualState={visualState}
            reducedMotion={reducedMotion}
            position={[0, 0.32, 0]}
            scale={0.8}
          />
        )}
        <StatusBeacon visualState={visualState} position={[0.075, 0.077, 0.065]} scale={0.18} />
      </group>
    </group>
  );
}
