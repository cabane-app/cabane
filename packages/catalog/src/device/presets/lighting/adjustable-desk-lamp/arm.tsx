import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Quaternion, TubeGeometry, Vector3 } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

type Point = [number, number, number];
export function LampArm({
  name,
  start,
  end,
  width = 0.012,
  depth = 0.012,
  color = "#dfdfd8",
}: {
  name: string;
  start: Point;
  end: Point;
  width?: number;
  depth?: number;
  color?: string;
}) {
  const a = new Vector3(...start);
  const b = new Vector3(...end);
  const direction = b.clone().sub(a);
  const rotation = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return (
    <mesh
      name={name}
      position={a.add(b).multiplyScalar(0.5).toArray()}
      quaternion={rotation.toArray()}
      castShadow
      userData={{ armEndpoints: [start, end] }}
    >
      <boxGeometry args={[width, direction.length(), depth]} />
      <ToonMaterial color={color} />
      <Outlines color="#777a76" thickness={0.0007} screenspace={false} />
    </mesh>
  );
}

export function LampSpring({ side }: { side: number }) {
  const geometry = useMemo(() => {
    const start = new Vector3(side * 0.029, 0.12, -0.0615);
    const end = new Vector3(side * 0.029, 0.24, -0.129);
    const axis = end.clone().sub(start).normalize();
    const across = new Vector3(1, 0, 0);
    const outward = axis.clone().cross(across);
    const points = Array.from({ length: 97 }, (_, index) => {
      const t = index / 96;
      const radius =
        Math.sin((Math.PI * Math.min(1, t * 12)) / 2) *
        Math.sin((Math.PI * Math.min(1, (1 - t) * 12)) / 2) *
        0.005;
      return start
        .clone()
        .lerp(end, t)
        .addScaledVector(across, Math.cos(t * Math.PI * 24) * radius)
        .addScaledVector(outward, Math.sin(t * Math.PI * 24) * radius);
    });
    return new TubeGeometry(new CatmullRomCurve3(points), 96, 0.0012, 4, false);
  }, [side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name={`desk-lamp-spring-${side}`} geometry={geometry}>
      <ToonMaterial color="#858b85" />
    </mesh>
  );
}
