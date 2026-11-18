import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";

const profile = (points: number[][]) =>
  points.map(([radius, height]) => new Vector2(radius, height));
// A laminated bentwood hoop; its front and back arrises roll over into the inner face.
const hoop = profile([
  [0.362, -0.055],
  [0.381, -0.055],
  [0.385, -0.051],
  [0.385, 0.047],
  [0.381, 0.052],
  [0.362, 0.052],
  [0.358, 0.048],
  [0.358, -0.051],
  [0.362, -0.055],
]);
const plyReveal = profile([
  [0.371, 0],
  [0.369, 0.0005],
  [0.367, 0],
]);
const glazeBand = profile([
  [0.0905, 0.039],
  [0.0935, 0.045],
  [0.0954, 0.049],
]);
const bottle = profile([
  [0, -0.001],
  [0.036, 0],
  [0.038, 0.008],
  [0.055, 0.014],
  [0.082, 0.046],
  [0.09, 0.078],
  [0.084, 0.106],
  [0.063, 0.129],
  [0.034, 0.144],
  [0.031, 0.163],
  [0.034, 0.167],
  [0.034, 0.172],
  [0.024, 0.172],
  [0.024, 0.154],
  [0.039, 0.124],
  [0, 0.121],
]);
const bowl = profile([
  [0, 0],
  [0.042, 0],
  [0.045, 0.009],
  [0.063, 0.014],
  [0.086, 0.032],
  [0.1, 0.061],
  [0.105, 0.092],
  [0.103, 0.1],
  [0.096, 0.1],
  [0.092, 0.086],
  [0.083, 0.06],
  [0.063, 0.041],
  [0.037, 0.033],
  [0, 0.033],
]);

export function RoundWallDisplay() {
  return (
    <group name="etagere-ronde-bedroom-two-photo">
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[hoop, 64]} />
          <ToonMaterial color="#b17e4a" />
        </mesh>
        <mesh position={[0, 0.0523, 0]}>
          <latheGeometry args={[plyReveal, 64]} />
          <ToonMaterial color="#987149" />
        </mesh>
      </group>
      <RoundedBox
        args={[0.727, 0.032, 0.205]}
        radius={0.005}
        smoothness={1}
        bevelSegments={1}
        position={[0, -0.082, 0.0525]}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#c28f57" />
      </RoundedBox>
      <mesh position={[-0.157, -0.066, 0.048]} castShadow receiveShadow>
        <latheGeometry args={[bottle, 28]} />
        <ToonMaterial color="#dfc9b8" />
      </mesh>
      <group position={[0.134, -0.066, 0.07]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[bowl, 32]} />
          <ToonMaterial color="#d79aae" />
        </mesh>
        <mesh>
          <latheGeometry args={[glazeBand, 32]} />
          <ToonMaterial color="#f0c3b0" />
        </mesh>
      </group>
    </group>
  );
}
