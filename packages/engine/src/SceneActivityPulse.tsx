import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshToonMaterial } from "three";
import { ToonMaterial } from "./rendering";

const noRaycast = () => undefined;

/** The shared zap impact, also used for brief feedback at a live device. */
export function SceneActivityPulse({
  color,
  delay = 0,
  reducedMotion = false,
  onComplete,
}: {
  color?: string | undefined;
  delay?: number;
  reducedMotion?: boolean;
  onComplete?: (() => void) | undefined;
}) {
  const root = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const age = useRef(0);
  const completed = useRef(false);
  useFrame((_, delta) => {
    age.current += delta;
    if (!root.current) return;
    const elapsed = age.current - delay;
    const progress = Math.max(0, Math.min(1, elapsed / 0.55));
    root.current.visible = elapsed >= 0 && progress < 1;
    if (progress >= 1) {
      if (!completed.current) onComplete?.();
      completed.current = true;
      return;
    }
    root.current.scale.setScalar(reducedMotion ? 1 : 0.5 + progress * 2);
    ring.current?.scale.setScalar(reducedMotion ? 1 : 1 + progress);
    for (const child of root.current.children) {
      const mesh = child as Mesh;
      (mesh.material as MeshToonMaterial).opacity =
        (child.userData.glowOpacity ?? 1) * (reducedMotion ? 0.35 : 1) * (1 - progress) ** 2;
    }
  });
  return (
    <group name="laser-impact" ref={root} visible={false}>
      <mesh raycast={noRaycast}>
        <icosahedronGeometry args={[0.045, 1]} />
        <ToonMaterial
          color={color ?? "#d5f6ff"}
          emissive={color ?? "#168fff"}
          emissiveIntensity={3}
          toneMapped={false}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} raycast={noRaycast}>
        <torusGeometry args={[0.052, 0.006, 5, 20]} />
        <ToonMaterial
          color={color ?? "#6dcaff"}
          emissive={color ?? "#6dcaff"}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh userData={{ glowOpacity: 0.24 }} raycast={noRaycast}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <ToonMaterial
          color={color ?? "#47eaff"}
          emissive={color ?? "#47eaff"}
          emissiveIntensity={2}
          toneMapped={false}
          transparent
          opacity={0.24}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {!reducedMotion &&
        Array.from({ length: 7 }, (_, index) => {
          const angle = (index * Math.PI * 2) / 7;
          return (
            <mesh
              key={index}
              position={[Math.cos(angle) * 0.07, Math.sin(angle) * 0.07, -0.008]}
              rotation={[0, 0, angle - Math.PI / 2]}
              raycast={noRaycast}
            >
              <coneGeometry args={[0.009, 0.06, 4]} />
              <ToonMaterial
                color={color ?? "#d5f6ff"}
                emissive={color ?? "#218fff"}
                emissiveIntensity={2}
                toneMapped={false}
                transparent
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          );
        })}
    </group>
  );
}
