import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2, BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useMemo, useEffect } from "react";
export const BRONZE_ARMILLARY_SIZE = [0.52, 0.68, 0.52] as const;
const profile = (points: number[][]) => points.map(([r, y]) => new Vector2(r, y));
const foot = profile([
  [0, 0],
  [0.112, 0],
  [0.127, 0.006],
  [0.13, 0.013],
  [0.13, 0.032],
  [0.122, 0.041],
  [0.111, 0.044],
  [0.106, 0.052],
  [0.094, 0.057],
  [0, 0.057],
]);
const stem = profile([
  [0, 0.052],
  [0.069, 0.052],
  [0.072, 0.059],
  [0.065, 0.067],
  [0.044, 0.071],
  [0.04, 0.081],
  [0.026, 0.087],
  [0.019, 0.122],
  [0.026, 0.133],
  [0.03, 0.14],
  [0.024, 0.15],
  [0.031, 0.158],
  [0.031, 0.17],
  [0, 0.17],
]);
function band(r: number, width: number, lip: number) {
  return profile([
    [r - lip, -width / 2],
    [r - 0.002, -width / 2],
    [r, -width / 2 + 0.002],
    [r, width / 2 - 0.002],
    [r - 0.002, width / 2],
    [r - lip, width / 2],
    [r - lip, -width / 2],
  ]);
}
const horizon = band(0.26, 0.015, 0.018),
  meridian = band(0.26, 0.016, 0.011),
  zodiac = band(0.208, 0.029, 0.005);
function Graduations() {
  const geometry = useMemo(() => {
    const marks = Array.from({ length: 48 }, (_, i) =>
      new BoxGeometry(i % 4 === 0 ? 0.0034 : 0.0019, 0.001, i % 4 === 0 ? 0.011 : 0.0055)
        .translate(0, 0.0077, 0.25)
        .rotateY((i * Math.PI) / 24),
    );
    const g = mergeGeometries(marks);
    marks.forEach((m) => m.dispose());
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <ToonMaterial color="#695335" />
    </mesh>
  );
}
export function BronzeArmillary({ size = BRONZE_ARMILLARY_SIZE }: { size?: SceneItemSize }) {
  return (
    <group name="bronze-armillary" scale={[size[0] / 0.52, size[1] / 0.68, size[2] / 0.52]}>
      <mesh name="stone-foot" castShadow receiveShadow>
        <latheGeometry args={[foot, 32]} />
        <ToonMaterial color="#c3b5a0" />
      </mesh>
      <mesh name="turned-stem" castShadow>
        <latheGeometry args={[stem, 24]} />
        <ToonMaterial color="#80633e" />
      </mesh>
      <group position={[0, 0.42, 0]}>
        <mesh name="meridian" rotation={[Math.PI / 2, 0, 0]} castShadow>
          <latheGeometry args={[meridian, 48]} />
          <ToonMaterial color="#92764c" />
        </mesh>
        <mesh name="horizon" castShadow>
          <latheGeometry args={[horizon, 48]} />
          <ToonMaterial color="#ac905d" />
        </mesh>
        <Graduations />
        <group rotation={[0, 0, -0.41]}>
          <mesh name="polar-axis" castShadow>
            <cylinderGeometry args={[0.005, 0.005, 0.502, 12]} />
            <ToonMaterial color="#80633e" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * 0.244, 0]}>
              <sphereGeometry args={[0.012, 12, 8]} />
              <ToonMaterial color="#b39764" />
            </mesh>
          ))}
          <mesh name="ecliptic" rotation={[0.23, 0, 0.13]} castShadow>
            <latheGeometry args={[zodiac, 48]} />
            <ToonMaterial color="#b19665" />
          </mesh>
          <mesh name="solstitial-colure" rotation={[0, 0.66, 0]}>
            <torusGeometry args={[0.205, 0.004, 6, 48]} />
            <ToonMaterial color="#92764c" />
          </mesh>
          <mesh name="celestial-sphere" castShadow>
            <sphereGeometry args={[0.073, 24, 16]} />
            <ToonMaterial color="#a58a56" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.073, 0.002, 6, 28]} />
            <ToonMaterial color="#d0ba85" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
