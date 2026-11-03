import { Outlines, ToonMaterial } from "@cabane/engine";
import { BoxGeometry, Quaternion, Vector3 } from "three";
import { useEffect, useMemo } from "react";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Point = [number, number, number];

export function BicycleTube({
  start,
  end,
  radius = 0.018,
  color = "#577c78",
}: {
  start: Point;
  end: Point;
  radius?: number;
  color?: string;
}) {
  const a = new Vector3(...start);
  const b = new Vector3(...end);
  const direction = b.clone().sub(a);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return (
    <mesh
      position={a.clone().add(b).multiplyScalar(0.5).toArray()}
      quaternion={quaternion.toArray()}
      userData={{ bicycleTube: { start, end } }}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, direction.length(), 8]} />
      <ToonMaterial color={color} />
    </mesh>
  );
}

export function BicycleWheel({ z, variant }: { z: number; variant: string }) {
  const tire = variant === "gravel" ? 0.018 : variant === "mtb" ? 0.03 : 0.026;
  const outer = variant === "mtb" ? 0.344 : 0.35;
  return (
    <group position={[0, 0.35, z]}>
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[outer - tire, tire, 8, 32]} />
        <ToonMaterial color="#343a3a" />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[outer - tire * 2, 0.009, 6, 32]} />
        <ToonMaterial color="#a7b3b0" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return (
          <BicycleTube
            key={i}
            start={[0, 0, 0]}
            end={[0, Math.cos(angle) * (outer - tire * 2), Math.sin(angle) * (outer - tire * 2)]}
            radius={0.003}
            color="#a7b3b0"
          />
        );
      })}
      <BicycleTube start={[-0.065, 0, 0]} end={[0.065, 0, 0]} radius={0.026} color="#6a7472" />
      {variant === "mtb" && <BicycleTread />}
    </group>
  );
}

export function BicycleSaddle() {
  return (
    <mesh position={[0, 0.985, -0.27]} scale={[0.095, 0.035, 0.155]} castShadow>
      <sphereGeometry args={[1, 16, 8]} />
      <ToonMaterial color="#414747" />
      <Outlines thickness={0.0015} screenspace={false} color="#303737" />
    </mesh>
  );
}

function BicycleTread() {
  const geometry = useMemo(() => {
    const blocks = Array.from({ length: 24 }, (_, i) => {
      const angle = (i * Math.PI) / 12;
      return new BoxGeometry(0.05, 0.018, 0.024)
        .rotateX(angle)
        .translate(0, Math.cos(angle) * 0.341, Math.sin(angle) * 0.341);
    });
    const merged = mergeGeometries(blocks);
    blocks.forEach((block) => block.dispose());
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <ToonMaterial color="#343a3a" />
    </mesh>
  );
}
