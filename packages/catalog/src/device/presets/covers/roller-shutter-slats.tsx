import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";

const COUNT = 31;
const RAIL_HEIGHT = 0.03;
const TOP = 1.54;
const TRAVEL = TOP - RAIL_HEIGHT;
const PITCH = TRAVEL / COUNT;

/** Full-size slats translate behind an exit strip deeper than one slat's pitch. */
export function RollerShutterSlats({
  position,
  reducedMotion,
}: {
  position: number | null;
  reducedMotion: boolean;
}) {
  const slats = useRef<Group>(null);
  const rail = useRef<Group>(null);
  const current = useRef((position ?? 50) / 100);
  const target = useRef(current.current);
  const invalidate = useThree((state) => state.invalidate);
  const applyPosition = (openness: number) => {
    const travel = TRAVEL * openness;
    slats.current?.children.forEach((slat, index) => {
      const center = RAIL_HEIGHT + (index + 0.5) * PITCH + travel;
      slat.visible = center + PITCH / 2 <= 1.6 + 1e-8;
      // Park hidden slats inside the concealed roll's visible envelope.
      slat.position.y = Math.min(center, 1.6 - PITCH / 2);
    });
    if (rail.current) rail.current.position.y = RAIL_HEIGHT / 2 + travel;
  };
  useLayoutEffect(() => {
    target.current = position === null ? current.current : position / 100;
    if (reducedMotion) current.current = target.current;
    applyPosition(current.current);
    invalidate();
  }, [position, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    const difference = target.current - current.current;
    if (Math.abs(difference) < 0.00001) return;
    current.current =
      Math.abs(difference) < 0.0001
        ? target.current
        : current.current + difference * (1 - Math.exp(-10 * Math.min(delta, 0.1)));
    applyPosition(current.current);
    invalidate();
  });
  return (
    <group name="shutter-moving-cover">
      <group ref={slats} name="shutter-slats">
        {Array.from({ length: COUNT }, (_, index) => (
          <mesh
            key={index}
            name={`shutter-slat-${index}`}
            position={[0, RAIL_HEIGHT + (index + 0.5) * PITCH, 0.018]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.15, PITCH, 0.014]} />
            <ToonMaterial color={index % 2 ? "#dedfd8" : "#e7e8e1"} />
          </mesh>
        ))}
      </group>
      <group ref={rail} name="shutter-bottom-rail" position={[0, RAIL_HEIGHT / 2, 0.02]}>
        <RoundedBox
          args={[1.15, RAIL_HEIGHT, 0.034]}
          radius={0.002}
          smoothness={1}
          bevelSegments={1}
          castShadow
          receiveShadow
        >
          <ToonMaterial color="#c5c9c0" />
          <Outlines color="#92958c" thickness={0.0015} screenspace={false} />
        </RoundedBox>
      </group>
    </group>
  );
}
