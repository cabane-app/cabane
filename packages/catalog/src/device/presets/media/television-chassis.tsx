import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { Shape } from "three";

// Each die-cast foot flares from the rear heel to a broad, swept toe.
const foot = new Shape();
foot.moveTo(-0.049, -0.095);
foot.lineTo(0.009, -0.095);
foot.lineTo(0.123, 0.054);
foot.lineTo(0.126, 0.068);
foot.lineTo(0.11, 0.0748);
foot.lineTo(0.051, 0.065);
foot.lineTo(-0.042, -0.035);
foot.closePath();
const casting = {
  depth: 0.014,
  bevelEnabled: true,
  bevelSegments: 2,
  bevelThickness: 0.005,
  bevelSize: 0.005,
};

export function TelevisionFeet() {
  return [-1, 1].map((side) => {
    const name = side < 0 ? "left" : "right";
    return (
      <group key={name} position={[side * 0.54, 0, 0]} scale={[side, 1, 1]}>
        <mesh
          userData={{ modelGlowKey: `tv.leg.${name}.foot` }}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0.019, 0]}
          castShadow
        >
          <extrudeGeometry args={[foot, casting]} />
          <ToonMaterial color="#596360" />
        </mesh>
        <mesh
          userData={{ modelGlowKey: `tv.leg.${name}.stem` }}
          position={[0.006, 0.082, -0.023]}
          rotation={[0.09, 0, 0.21]}
          castShadow
        >
          <cylinderGeometry args={[0.028, 0.021, 0.143, 8]} />
          <ToonMaterial color="#47534f" />
        </mesh>
      </group>
    );
  });
}

const perforations: number[] = [];
for (const side of [-1, 1]) {
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 37; i++) {
      const x = side * (0.081 + i * 0.014 + row * 0.005);
      const y = 0.127 + row * 0.007;
      perforations.push(
        x - 0.003,
        y,
        0,
        x,
        y - 0.0025,
        0,
        x + 0.003,
        y,
        0,
        x - 0.003,
        y,
        0,
        x + 0.003,
        y,
        0,
        x,
        y + 0.0025,
        0,
      );
    }
  }
}
const vertices = new Float32Array(perforations);
const normals = Float32Array.from(vertices, (_, i) => (i % 3 === 2 ? 1 : 0));

export function TelevisionChassis() {
  return (
    <>
      <RoundedBox
        args={[1.055, 0.52, 0.065]}
        radius={0.024}
        bevelSegments={2}
        smoothness={1}
        position={[0, 0.42, -0.039]}
        castShadow
      >
        <ToonMaterial color="#34403e" />
      </RoundedBox>
      <RoundedBox
        args={[1.443, 0.715, 0.013]}
        radius={0.006}
        bevelSegments={1}
        smoothness={1}
        position={[0, 0.515, 0.025]}
        receiveShadow
      >
        <ToonMaterial color="#101b1c" />
      </RoundedBox>
      <RoundedBox
        args={[1.39, 0.042, 0.022]}
        radius={0.009}
        bevelSegments={1}
        smoothness={1}
        position={[0, 0.13, 0.026]}
      >
        <ToonMaterial color="#505d59" />
      </RoundedBox>
      <mesh position={[0, 0, 0.038]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
          <bufferAttribute attach="attributes-normal" args={[normals, 3]} />
        </bufferGeometry>
        <ToonMaterial color="#2a3532" />
      </mesh>
    </>
  );
}
