import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { turnedProfile } from "../../visuals/turned-profile";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import { ToonMaterial, Outlines } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { SprinklerSpray } from "./sprinkler-spray";

const groundCap = turnedProfile(
  [
    [0, 0],
    [0.062, 0],
    [0.07, 0.008],
    [0.07, 0.016],
    [0.066, 0.022],
    [0.044, 0.024],
    [0.04, 0.029],
    [0.036, 0.03],
    [0.026, 0.03],
    [0.024, 0.023],
    [0, 0.023],
  ],
  24,
);
const capGrips = mergeGeometries(
  Array.from({ length: 8 }, (_, index) =>
    new BoxGeometry(0.004, 0.004, 0.019)
      .rotateX(0.1)
      .translate(0, 0.023, 0.052)
      .rotateY((index * Math.PI) / 4),
  ),
);
const telescopingStem = turnedProfile(
  [
    [0.025, -0.008],
    [0.025, 0.046],
    [0.028, 0.048],
    [0.028, 0.055],
    [0.019, 0.059],
    [0.017, 0.126],
  ],
  16,
);
const nozzleHead = turnedProfile(
  [
    [0.017, 0.12],
    [0.026, 0.124],
    [0.031, 0.131],
    [0.031, 0.14],
    [0.027, 0.146],
    [0.021, 0.148],
    [0, 0.148],
  ],
  20,
);
const nozzleInsert = turnedProfile(
  [
    [0.019, 0.146],
    [0.019, 0.149],
    [0.015, 0.152],
    [0.007, 0.152],
    [0.004, 0.148],
  ],
  16,
  -Math.PI * 0.83,
  Math.PI * 1.66,
);

export function PopUpSprinklerModel({ visualState, reducedMotion }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  const riser = useRef<Group>(null);
  const initialScale = useRef<[number, number, number]>([1, active ? 1 : 0.08, 1]);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  }, [active, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    if (!riser.current) return;
    const target = active ? 1 : 0.08;
    riser.current.scale.y = reducedMotion
      ? target
      : MathUtils.damp(riser.current.scale.y, target, 9, Math.min(delta, 0.05));
    if (Math.abs(riser.current.scale.y - target) > 0.0001) invalidate();
  });
  return (
    <group name="catalog-pop-up-sprinkler">
      <mesh geometry={groundCap}>
        <ToonMaterial color="#34433e" />
        <Outlines color="#24312c" thickness={0.001} screenspace={false} />
      </mesh>
      <mesh geometry={capGrips}>
        <ToonMaterial color="#53675a" />
      </mesh>
      <group
        ref={riser}
        name="sprinkler-riser"
        position={[0, 0.03, 0]}
        scale={initialScale.current}
      >
        <mesh geometry={telescopingStem}>
          <ToonMaterial color="#899b99" />
        </mesh>
        <mesh geometry={nozzleHead}>
          <ToonMaterial color="#283c32" />
        </mesh>
        <mesh geometry={nozzleInsert}>
          <ToonMaterial color={active ? "#73c398" : "#60876b"} />
        </mesh>
        {active && (
          <group position={[0, 0.1, 0]}>
            <SprinklerSpray reducedMotion={reducedMotion ?? false} />
          </group>
        )}
      </group>
    </group>
  );
}
