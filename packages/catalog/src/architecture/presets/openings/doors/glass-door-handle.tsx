import { useEffect } from "react";
import type { BufferGeometry } from "three";
import {
  JoineryMaterial,
  Outlines,
  RoundedBox,
  ToonMaterial,
  useDetailedJoinery,
} from "@cabane/engine";
import { glassPullGeometry } from "./glass-pull-geometry";

// Every glazed leaf uses this exact pull. The last mounted copy frees GPU
// buffers; the weak reference lets the CPU arrays go when the scene releases them.
let cachedPull: WeakRef<BufferGeometry> | undefined;
let mountedPulls = 0;
function sharedGlassPull() {
  const existing = cachedPull?.deref();
  if (existing) return existing;
  const geometry = glassPullGeometry();
  cachedPull = new WeakRef(geometry);
  return geometry;
}

export function GlassDoorHandle({ width, side }: { width: number; side: -1 | 1 }) {
  const detailed = useDetailedJoinery();
  const geometry = detailed ? sharedGlassPull() : null;
  useEffect(() => {
    if (!geometry) return;
    mountedPulls++;
    return () => {
      if (--mountedPulls === 0) geometry.dispose();
    };
  }, [geometry]);
  return (
    <group
      name="opening-glass-door-handle"
      position={[side * (width / 2 - Math.min(0.1, width * 0.22)), -0.02, 0]}
    >
      {geometry ? (
        <mesh geometry={geometry} castShadow receiveShadow>
          <JoineryMaterial color="#79827e" finish="metal" />
        </mesh>
      ) : (
        ([-1, 1] as const).map((face) => (
          <RoundedBox
            key={face}
            args={[0.025, 0.24, 0.026]}
            radius={0.008}
            smoothness={2}
            position={[0, 0, face * 0.075]}
            castShadow
          >
            <ToonMaterial color="#4f5655" />
            <Outlines thickness={0.004} color="#353938" screenspace={false} />
          </RoundedBox>
        ))
      )}
    </group>
  );
}
