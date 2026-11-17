import { glovePalette } from "./glove-palette";
import { RoundedBox, ToonMaterial } from "@cabane/engine";
import { GloveDigit } from "./GloveDigit";

import { BlasterHand } from "./BlasterHand";
import { BlasterFinish } from "./BlasterFinish";

type Point = [number, number, number];

// Local coordinates follow the raked handle. Each finger starts inside the palm,
// crosses the front face and curls back along the opposite side.
const fingerPath: Point[] = [
  [0.063, 0, 0.031],
  [0.067, 0.002, -0.018],
  [0.054, 0.001, -0.053],
  [0.012, -0.002, -0.062],
  [-0.042, -0.003, -0.059],
  [-0.063, 0, -0.037],
  [-0.064, 0.004, -0.015],
];
const thumbPath: Point[] = [
  [0.065, 0.005, 0.042],
  [0.045, 0.021, 0.062],
  [0.009, 0.04, 0.07],
  [-0.035, 0.051, 0.063],
  [-0.064, 0.056, 0.041],
  [-0.069, 0.06, 0.015],
  [-0.065, 0.064, -0.022],
];

export function BlasterGlove({ pose = "laser" }: { pose?: "flashlight" | "laser" }) {
  if (pose === "laser") return <BlasterHand />;
  return (
    <group name="blaster-gloved-hand" position={[0, 0, 0.025]} rotation={[1.74, 0, 0.48]}>
      <group position={[0.074, -0.007, 0.026]} rotation={[0.03, -0.16, -0.08]}>
        <RoundedBox args={[0.06, 0.147, 0.113]} radius={0.027}>
          <BlasterFinish kind="grip" />
        </RoundedBox>
        <RoundedBox args={[0.046, 0.099, 0.065]} radius={0.017} position={[0.015, 0.003, 0.039]}>
          <BlasterFinish kind="armor" />
        </RoundedBox>
      </group>
      {[0.045, 0.009, -0.027, -0.061].map((y, index) => (
        <group key={y} position={[0, y, 0]} scale={index === 3 ? [0.96, 0.88, 0.96] : 1}>
          <GloveDigit path={fingerPath} radius={0.019} />
        </group>
      ))}
      <GloveDigit path={thumbPath} radius={0.022} />
      <group position={[0.09, 0.063, 0.07]} rotation={[-1.9, 0, 0.3]}>
        <mesh position={[0, -0.42, 0]}>
          <cylinderGeometry args={[0.049, 0.082, 0.7, 20]} />
          <ToonMaterial color={glovePalette.sleeve} />
        </mesh>
        <RoundedBox args={[0.092, 0.135, 0.099]} radius={0.031}>
          <BlasterFinish kind="grip" />
        </RoundedBox>
        <RoundedBox args={[0.108, 0.073, 0.113]} radius={0.021} position={[0, -0.054, 0]}>
          <BlasterFinish kind="armor" />
        </RoundedBox>
        <RoundedBox args={[0.11, 0.013, 0.115]} radius={0.005} position={[0, -0.027, 0]}>
          <BlasterFinish kind="trim" />
        </RoundedBox>
      </group>
    </group>
  );
}
