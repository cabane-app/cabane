import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { useRef, useMemo } from "react";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Three analytic light ribbons: no textures, ray marching or offscreen render passes.
const fragmentShader = /* glsl */ `
  uniform float time;
  uniform float aspect;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    p.x *= aspect;
    vec3 color = vec3(0.004, 0.008, 0.025);
    for (int i = 0; i < 3; i++) {
      float band = float(i);
      float wave = 0.16 * sin(p.x * 2.5 + time * 0.22 + band * 1.4)
        + 0.06 * sin(p.x * 5.0 - time * 0.15 + band);
      float d = p.y - wave + (band - 1.0) * 0.12;
      float core = exp(-abs(d) * 48.0);
      float halo = exp(-abs(d) * 11.0);
      float curtain = 0.65 + 0.35 * sin(p.x * 9.0 + time * 0.18 + band);
      vec3 tint = mix(vec3(0.025, 0.65, 0.46), vec3(0.32, 0.09, 0.72), band * 0.5);
      color += tint * (core * 0.65 + halo * 0.25) * curtain;
    }
    float vignette = 1.0 - smoothstep(0.25, 0.72, length(vUv - 0.5));
    gl_FragColor = vec4(color * (0.45 + 0.55 * vignette), 1.0);
    #include <colorspace_fragment>
  }
`;

/** A quiet aurora screensaver, confined to a single two-triangle screen. */
export function TelevisionPicture({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ time: { value: 0 }, aspect: { value: width / height } }),
    [width, height],
  );
  useFrame(({ invalidate }, delta) => {
    if (reducedMotion || !material.current) return;
    material.current.uniforms.time.value += Math.min(delta, 0.05);
    invalidate();
  });
  return (
    <group name="television-picture" scale={[width, height, 1]}>
      <mesh name="television-picture-motion">
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}
