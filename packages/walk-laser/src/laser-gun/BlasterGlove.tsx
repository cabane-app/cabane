import { RoundedBox } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
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

function GloveDigit({ path, radius }: { path: Point[]; radius: number }) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(path.map(([x, y, z]) => new Vector3(x, y, z)));
    const tube = new TubeGeometry(curve, 24, radius, 10, false);
    // Close and round the fingertip by tapering the last rings into the tip.
    const vertices = tube.attributes.position!;
    for (let ring = 20; ring <= 24; ring++) {
      const center = curve.getPointAt(ring / 24);
      const scale = Math.sqrt(1 - ((ring - 20) / 4) ** 2);
      for (let side = 0; side <= 10; side++) {
        const index = ring * 11 + side;
        const point = new Vector3()
          .fromBufferAttribute(vertices, index)
          .sub(center)
          .multiplyScalar(scale)
          .add(center);
        vertices.setXYZ(index, point.x, point.y, point.z);
      }
    }
    tube.computeVertexNormals();
    return tube;
  }, [path, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <BlasterFinish kind="grip" />
    </mesh>
  );
}

export function BlasterGlove() {
  return (
    <group name="blaster-gloved-hand" position={[0, -0.169, 0.165]} rotation={[-0.34, 0, 0]}>
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
      <group position={[0.074, -0.097, 0.079]} rotation={[-0.55, 0, -0.15]}>
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
