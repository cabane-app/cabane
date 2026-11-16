import { ToonMaterial } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { branch, type Point } from "../outdoor/vegetation/geometry";

type Blade = {
  start: Point;
  tip: Point;
  width: number;
  arch: number;
  roll?: number;
  color: string;
};
export type HouseplantGrowth = {
  stems: [Point, Point, number, number][];
  leaves: Blade[];
  min: Point;
  max: Point;
  bark: string;
  bladeProfile?: number[];
};

function blade({ start, tip, width, arch, roll = 0, color }: Blade, profile: number[]) {
  const a = new Vector3(...start),
    b = new Vector3(...tip);
  const across = new Vector3(b.z - a.z, 0, a.x - b.x)
    .normalize()
    .applyAxisAngle(b.clone().sub(a).normalize(), roll);
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const hue = new Color(color);
  for (const [row, spread] of profile.entries()) {
    const t = row / (profile.length - 1);
    const center = a.clone().lerp(b, t);
    center.y += Math.sin(t * Math.PI) * arch;
    for (const side of [-1, 0, 1]) {
      const vertex = center.clone().addScaledVector(across, side * width * spread);
      vertex.y += side === 0 ? spread * width * 0.25 : 0;
      positions.push(...vertex.toArray());
      colors.push(
        ...hue
          .clone()
          .multiplyScalar(side === -1 ? 0.89 : 1)
          .toArray(),
      );
    }
    if (row < profile.length - 1) {
      const i = row * 3;
      indices.push(i, i + 3, i + 1, i + 1, i + 3, i + 4, i + 1, i + 4, i + 2, i + 2, i + 4, i + 5);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function HouseplantFoliage({ growth }: { growth: HouseplantGrowth }) {
  const geometry = useMemo(() => {
    const stems = growth.stems.map(([a, b, base, tip]) => branch(a, b, base, tip));
    const profile = growth.bladeProfile ?? [0.015, 0.75, 1, 0.72, 0.012];
    const leaves = growth.leaves.map((leaf) => blade(leaf, profile));
    const wood = mergeGeometries(stems),
      blades = mergeGeometries(leaves);
    [...stems, ...leaves].forEach((part) => part.dispose());
    const bounds = new Box3();
    for (const part of [wood, blades]) {
      part.computeBoundingBox();
      bounds.union(part.boundingBox!);
    }
    const scale = new Vector3(...growth.max)
      .sub(new Vector3(...growth.min))
      .divide(bounds.getSize(new Vector3()));
    const fit = new Matrix4()
      .makeScale(...scale.toArray())
      .multiply(new Matrix4().makeTranslation(...bounds.min.clone().negate().toArray()));
    for (const part of [wood, blades]) part.applyMatrix4(fit).translate(...growth.min);
    return { wood, blades };
  }, [growth]);
  useEffect(
    () => () => {
      geometry.wood.dispose();
      geometry.blades.dispose();
    },
    [geometry],
  );
  return (
    <>
      <mesh geometry={geometry.wood} castShadow>
        <ToonMaterial color={growth.bark} />
      </mesh>
      <mesh geometry={geometry.blades} castShadow receiveShadow>
        <ToonMaterial side={DoubleSide} vertexColors />
      </mesh>
    </>
  );
}
