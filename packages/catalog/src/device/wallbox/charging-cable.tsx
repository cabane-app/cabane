import { useMemo } from "react";
import { CubicBezierCurve3, CurvePath, LineCurve3, Vector3 } from "three";
import { Outlines, RoundedBox, ToonMaterial } from "@cabane/engine";

/** The cable enters the enclosure underneath and returns to its docked plug. */
export function ChargingCable() {
  const path = useMemo(() => {
    const curve = new CurvePath<Vector3>();
    const point = (x: number, y: number) => new Vector3(x, y, 0.12);
    curve.add(new LineCurve3(point(-0.12, 0.38), point(-0.12, 0.13)));
    curve.add(
      new CubicBezierCurve3(
        point(-0.12, 0.13),
        point(-0.12, 0.06373),
        point(-0.06627, 0.01),
        point(0, 0.01),
      ),
    );
    curve.add(
      new CubicBezierCurve3(
        point(0, 0.01),
        point(0.06627, 0.01),
        point(0.12, 0.06373),
        point(0.12, 0.13),
      ),
    );
    curve.add(new LineCurve3(point(0.12, 0.13), new Vector3(0.12, 0.4, 0.2)));
    return curve;
  }, []);
  return (
    <group name="wallbox-charging-cable">
      <mesh>
        <tubeGeometry args={[path, 64, 0.01, 8, false]} />
        <ToonMaterial color="#414b50" />
      </mesh>
      <mesh position={[-0.12, 0.365, 0.12]}>
        <cylinderGeometry args={[0.016, 0.014, 0.03, 12]} />
        <ToonMaterial color="#414b50" />
      </mesh>
      <RoundedBox
        args={[0.045, 0.1, 0.045]}
        radius={0.01}
        smoothness={2}
        position={[0.12, 0.43, 0.2]}
      >
        <ToonMaterial color="#4f5c61" />
        <Outlines color="#303b40" thickness={0.001} screenspace={false} />
      </RoundedBox>
      <mesh position={[0.12, 0.485, 0.2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.025, 12]} />
        <ToonMaterial color="#8d9798" />
      </mesh>
      <RoundedBox
        args={[0.055, 0.065, 0.08]}
        radius={0.009}
        smoothness={2}
        position={[0.12, 0.505, 0.175]}
      >
        <ToonMaterial color="#3d494e" />
      </RoundedBox>
    </group>
  );
}
