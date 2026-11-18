import { ToonMaterial } from "@cabane/engine";

// All optics sit outside the video aperture and share a single translucent draw.
const positions: number[] = [];
function stroke(x: number, y: number, width: number, height: number) {
  const l = x - width / 2,
    r = x + width / 2,
    b = y - height / 2,
    t = y + height / 2;
  positions.push(l, b, 0, r, b, 0, r, t, 0, l, b, 0, r, t, 0, l, t, 0);
}
for (const x of [-1, 1])
  for (const y of [-1, 1]) {
    stroke(x * 0.405, y * 0.252, 0.055, 0.003);
    stroke(x * 0.432, y * 0.212, 0.003, 0.06);
  }
stroke(0.06, 0.268, 0.48, 0.0015);
stroke(-0.08, -0.268, 0.55, 0.0015);
stroke(-0.449, 0, 0.0015, 0.28);
stroke(0.449, 0.035, 0.0015, 0.21);
for (let i = 0; i < 7; i++) stroke(-0.415, -0.09 + i * 0.025, i % 3 === 0 ? 0.014 : 0.007, 0.0015);
[0.025, 0.012, 0.006].forEach((width, i) => stroke(-0.3 + i * 0.035, -0.249, width, 0.003));
const vertices = new Float32Array(positions);
const normals = Float32Array.from(vertices, (_, i) => (i % 3 === 2 ? 1 : 0));

export function CameraReticle({ z }: { z: number }) {
  return (
    <mesh position={[0, 0, z]} renderOrder={12}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
        <bufferAttribute attach="attributes-normal" args={[normals, 3]} />
      </bufferGeometry>
      <ToonMaterial
        color="#78fff5"
        emissive="#2de1d7"
        emissiveIntensity={0.8}
        transparent
        opacity={0.7}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
