import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { Shape } from "three";

// Cast end shoes shield each emitter where the projection meets the wall.
const shoe = new Shape();
shoe.moveTo(-0.012, -0.174);
shoe.lineTo(0.008, -0.164);
shoe.lineTo(0.021, -0.117);
shoe.lineTo(0.021, 0.113);
shoe.lineTo(0.011, 0.161);
shoe.lineTo(-0.01, 0.18);
shoe.lineTo(-0.018, 0.163);
shoe.lineTo(-0.018, -0.153);
shoe.closePath();
const casting = {
  depth: 0.021,
  bevelEnabled: true,
  bevelThickness: 0.003,
  bevelSize: 0.003,
  bevelSegments: 1,
  curveSegments: 1,
};

export function CameraProjector() {
  return [-1, 1].map((side) => (
    <group key={side} position={[side * 0.464, 0.31, 0.003]} scale={[side, 1, 1]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shoe, casting]} />
        <ToonMaterial color="#405b58" />
      </mesh>
      <RoundedBox
        args={[0.016, 0.259, 0.012]}
        radius={0.004}
        smoothness={1}
        bevelSegments={1}
        position={[0.001, 0, 0.025]}
      >
        <ToonMaterial color="#8fa6a0" />
      </RoundedBox>
      <mesh position={[-0.002, 0, 0.032]}>
        <planeGeometry args={[0.005, 0.196]} />
        <ToonMaterial color="#8de4d9" emissive="#3a9c94" emissiveIntensity={0.4} />
      </mesh>
    </group>
  ));
}
