import { ToonMaterial } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector2, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function lampProfile(points: readonly (readonly [number, number])[]) {
  return points.map(([radius, height]) => new Vector2(radius, height));
}

/** Bent wire arms run from the lamp holder to the inner face of the shade. */
export function ShadeFrame({
  path,
  gauge,
  color,
  name = "shade-frame",
}: {
  readonly path: readonly Vector2[];
  readonly gauge: number;
  readonly color: string;
  readonly name?: string;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(path.map(({ x, y }) => new Vector3(x, y, 0)));
    const arms = [0, 1, 2].map((i) =>
      new TubeGeometry(curve, path.length * 3, gauge, 5, false).rotateY((i * Math.PI * 2) / 3),
    );
    const frame = mergeGeometries(arms);
    arms.forEach((arm) => arm.dispose());
    return frame;
  }, [path, gauge]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name={name} geometry={geometry} castShadow>
      <ToonMaterial color={color} />
    </mesh>
  );
}
