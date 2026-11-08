import { useMemo } from "react";
import { Path, Shape } from "three";
import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

/** Two genuine rounded openings cut through a white case, with a recessed back. */
export function ArchedBookcaseFrame() {
  const shape = useMemo(() => {
    const result = new Shape();
    result.moveTo(-0.5, 0);
    result.lineTo(0.5, 0);
    result.lineTo(0.5, 1.73);
    result.lineTo(-0.5, 1.73);
    result.closePath();
    for (const x of [-0.245, 0.245]) {
      const hole = new Path();
      hole.moveTo(x - 0.215, 0.025);
      hole.lineTo(x - 0.215, 1.47);
      hole.absarc(x, 1.47, 0.215, Math.PI, 0, true);
      hole.lineTo(x + 0.215, 0.025);
      hole.closePath();
      result.holes.push(hole);
    }
    return result;
  }, []);
  return (
    <group>
      <mesh name="double-arched-case" position={[0, 0, -0.18]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: 0.36, bevelEnabled: false, curveSegments: 24 }]} />
        <ToonMaterial color="#eeeee5" />
      </mesh>
      <RoundedFurniturePanel
        size={[0.94, 1.68, 0.02]}
        position={[0, 0.865, -0.155]}
        color="#c5c2b6"
        radius={0.002}
        outline={false}
      />
    </group>
  );
}
