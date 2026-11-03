import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

const TRAVEL = 1.44;
const TOP = 1.48;

/** The cloth retracts into the fixed headbox; the bottom rail keeps its thickness. */
export function BlindFabric({
  position,
  reducedMotion,
  color,
}: {
  position: number | null;
  color?: string | undefined;
  reducedMotion: boolean;
}) {
  const cloth = useRef<Group>(null);
  const rail = useRef<Group>(null);
  const current = useRef((position ?? 50) / 100);
  const target = useRef(current.current);
  const invalidate = useThree((state) => state.invalidate);
  const applyPosition = (openness: number) => {
    if (cloth.current) {
      cloth.current.scale.y = Math.max(0.00001, 1 - openness);
      cloth.current.visible = openness < 0.99999;
    }
    if (rail.current) rail.current.position.y = 0.02 + TRAVEL * openness;
  };
  useLayoutEffect(() => {
    target.current = position === null ? current.current : position / 100;
    if (reducedMotion) current.current = target.current;
    applyPosition(current.current);
    invalidate();
  }, [position, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    const difference = target.current - current.current;
    if (Math.abs(difference) < 0.0001) return;
    current.current =
      Math.abs(difference) < 0.001
        ? target.current
        : current.current + difference * (1 - Math.exp(-10 * Math.min(delta, 0.1)));
    applyPosition(current.current);
    invalidate();
  });
  return (
    <group name="blind-moving-cover">
      <group ref={cloth} name="blind-fabric" position={[0, TOP, 0.072]}>
        <mesh position={[0, -TRAVEL / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.12, TRAVEL, 0.008]} />
          <ToonMaterial color={color ?? "#d9d4c6"} />
        </mesh>
      </group>
      <group ref={rail} name="blind-bottom-rail" position={[0, 0.02, 0.072]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.14, 0.04, 0.028]} />
          <ToonMaterial color="#b8bcb2" />
          <Outlines color="#59605a" thickness={0.0015} screenspace={false} />
        </mesh>
      </group>
    </group>
  );
}
