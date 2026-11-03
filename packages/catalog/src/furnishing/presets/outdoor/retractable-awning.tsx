import { useMemo } from "react";
import type { SceneModelProps } from "@cabane/engine";
import { ToonMaterial } from "@cabane/engine";
import { Shape } from "three";
import { RoundedFurniturePanel as Panel } from "../construction";
import { FoldingFrameStrip as Strip } from "./bistro/folding-frame-strip";
export const RETRACTABLE_AWNING_SIZE = [3.6, 0.45, 1] as const;
/** Static extended canopy, front +Z; the cassette mounts to the wall at -Z. */
export function RetractableAwning({
  size = RETRACTABLE_AWNING_SIZE,
  color,
}: Pick<SceneModelProps, "size" | "color">) {
  const valance = useMemo(() => {
    const s = new Shape();
    s.moveTo(-1.8, 0.205);
    s.lineTo(1.8, 0.205);
    s.lineTo(1.8, 0.035);
    for (let i = 0; i < 12; i++) {
      const x = 1.8 - i * 0.3;
      s.quadraticCurveTo(x - 0.075, 0, x - 0.15, 0);
      s.quadraticCurveTo(x - 0.225, 0, x - 0.3, 0.035);
    }
    s.closePath();
    return s;
  }, []);
  return (
    <group name="retractable-awning" scale={[size[0] / 3.6, size[1] / 0.45, size[2]]}>
      <mesh
        name="awning-cassette"
        position={[0, 0.41, -0.46]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.04, 0.04, 3.6, 16]} />
        <ToonMaterial color="#414641" />
      </mesh>
      <Panel
        name="awning-canvas"
        size={[3.6, 0.016, Math.hypot(0.97, 0.22)]}
        position={[0, 0.315, -0.005]}
        rotation={[Math.atan2(0.22, 0.97), 0, 0]}
        color={color ?? "#293e60"}
        radius={0.002}
      />
      <mesh name="awning-valance" position={[0, 0, 0.49]} castShadow receiveShadow>
        <extrudeGeometry args={[valance, { depth: 0.01, bevelEnabled: false, curveSegments: 5 }]} />
        <ToonMaterial color={color ?? "#293e60"} />
      </mesh>
      {[-1.45, 1.45].map((x) => (
        <group key={x}>
          <Strip name="awning-wall-arm" from={[x, 0.38, -0.46]} to={[x + 0.08, 0.278, 0.02]} />
          <Strip name="awning-front-arm" from={[x + 0.08, 0.278, 0.02]} to={[x, 0.185, 0.475]} />
          <Panel
            name="awning-mount"
            size={[0.045, 0.11, 0.055]}
            position={[x, 0.39, -0.4725]}
            color="#414641"
            radius={0.001}
          />
        </group>
      ))}
      <Panel
        name="awning-front-rail"
        size={[3.58, 0.026, 0.026]}
        position={[0, 0.195, 0.476]}
        color="#414641"
        radius={0.002}
      />
    </group>
  );
}
