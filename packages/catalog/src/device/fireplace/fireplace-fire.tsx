import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector2 } from "three";
import { ToonMaterial } from "@cabane/engine";

const flameProfile = [
  new Vector2(0, 0),
  new Vector2(0.065, 0.035),
  new Vector2(0.055, 0.11),
  new Vector2(0.025, 0.2),
  new Vector2(0, 0.29),
];

/** Small solid tongues of fire; scene illumination remains engine-owned. */
export function FireplaceFire({ reducedMotion }: { reducedMotion: boolean }) {
  const flames = useRef<Group>(null);
  const elapsed = useRef(0);
  useFrame(({ invalidate }, delta) => {
    if (!flames.current) return;
    if (!reducedMotion) elapsed.current += delta;
    flames.current.scale.y = reducedMotion ? 1 : 1 + 0.08 * Math.sin(elapsed.current * 5);
    if (!reducedMotion) invalidate();
  });
  return (
    <group name="fireplace-flames" ref={flames} position={[0, 0.17, 0.23]}>
      {[-1, 0, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.15, 0, side === 0 ? 0.015 : 0]}
          scale={[1, side === 0 ? 1.2 : 0.9, 0.7]}
        >
          <latheGeometry args={[flameProfile, 8]} />
          <ToonMaterial
            color={side === 0 ? "#ffc963" : "#ee8a38"}
            emissive="#ef8b36"
            emissiveIntensity={0.65}
          />
        </mesh>
      ))}
    </group>
  );
}
