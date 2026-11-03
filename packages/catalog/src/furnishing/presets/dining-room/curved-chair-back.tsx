import { useMemo } from "react";
import { Shape } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

const extrusion = { depth: 0.16, steps: 1, bevelEnabled: false, curveSegments: 16 };

/** A bent oak backrest: a solid curved strip in plan, extruded vertically. */
export function CurvedChairBack() {
  const shape = useMemo(() => {
    const strip = new Shape();
    strip.moveTo(-0.245, -0.125);
    strip.quadraticCurveTo(0, -0.325, 0.245, -0.125);
    strip.lineTo(0.232, -0.1);
    strip.quadraticCurveTo(0, -0.289, -0.232, -0.1);
    strip.closePath();
    return strip;
  }, []);
  return (
    <mesh
      name="curved-oak-backrest"
      position={[0, 0.82, -0.025]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrusion]} />
      <ToonMaterial color="#d5b17e" />
      <Outlines color="#82694b" thickness={0.0015} screenspace={false} />
    </mesh>
  );
}
