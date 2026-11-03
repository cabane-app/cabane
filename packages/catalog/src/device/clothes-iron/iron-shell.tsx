import { useMemo } from "react";
import { Shape } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

/** Rounded heel, broad shoulders and a pointed +Z nose. */
function soleOutline() {
  const shape = new Shape();
  shape.moveTo(-0.045, -0.115);
  shape.lineTo(0.045, -0.115);
  shape.quadraticCurveTo(0.06, -0.115, 0.06, -0.09);
  shape.lineTo(0.06, -0.045);
  shape.quadraticCurveTo(0.058, 0.045, 0, 0.145);
  shape.quadraticCurveTo(-0.058, 0.045, -0.06, -0.045);
  shape.lineTo(-0.06, -0.09);
  shape.quadraticCurveTo(-0.06, -0.115, -0.045, -0.115);
  return shape;
}

export function IronShell() {
  const shape = useMemo(soleOutline, []);
  return (
    <group>
      <mesh
        name="iron-soleplate"
        position={[0, 0.008, 0.015]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[shape, { depth: 0.008, bevelEnabled: false, curveSegments: 8 }]} />
        <ToonMaterial color="#aab4b7" />
      </mesh>
      <mesh
        name="iron-soleplate-trim"
        position={[0, 0.018, 0.015]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.97, 0.97, 1]}
      >
        <extrudeGeometry args={[shape, { depth: 0.012, bevelEnabled: false, curveSegments: 8 }]} />
        <ToonMaterial color="#58676d" />
      </mesh>
      <mesh
        name="iron-water-reservoir"
        position={[0, 0.059, 0.015]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.87, 0.9, 1]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.042,
              bevelEnabled: true,
              bevelThickness: 0.003,
              bevelSize: 0.003,
              bevelSegments: 2,
              steps: 1,
              curveSegments: 8,
            },
          ]}
        />
        <ToonMaterial color="#91b6bd" />
        <Outlines color="#577e87" thickness={0.001} screenspace={false} />
      </mesh>
    </group>
  );
}
