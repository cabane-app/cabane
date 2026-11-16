import { Outlines, ToonMaterial } from "@cabane/engine";
import { Path, Shape } from "three";

function arch(inset: number) {
  const radius = 0.27 - inset;
  const shape = new Shape();
  shape.moveTo(-radius, inset);
  shape.lineTo(radius, inset);
  shape.lineTo(radius, 0.78);
  shape.absarc(0, 0.78, radius, 0, Math.PI, false);
  shape.closePath();
  return shape;
}
const frame = arch(0.004);
frame.holes.push(new Path(arch(0.034).getPoints(12)));
const bead = arch(0.029);
bead.holes.push(new Path(arch(0.037).getPoints(12)));
const silver = arch(0.034);

export function ArchedMirror() {
  return (
    <group name="arched-wood-mirror">
      <mesh name="rounded-timber-surround" position={[0, 0, -0.026]} castShadow>
        <extrudeGeometry
          args={[
            frame,
            {
              depth: 0.052,
              bevelEnabled: true,
              bevelSize: 0.004,
              bevelThickness: 0.004,
              bevelSegments: 2,
              curveSegments: 12,
            },
          ]}
        />
        <ToonMaterial color="#875d42" />
        <Outlines color="#72513d" thickness={0.0013} screenspace={false} />
      </mesh>
      <mesh name="inner-glazing-bead" position={[0, 0, 0.006]}>
        <extrudeGeometry
          args={[
            bead,
            {
              depth: 0.012,
              bevelEnabled: true,
              bevelSize: 0.0015,
              bevelThickness: 0.002,
              bevelSegments: 1,
              curveSegments: 12,
            },
          ]}
        />
        <ToonMaterial color="#a47753" />
      </mesh>
      <mesh name="recessed-arched-glass" position={[0, 0, -0.02]}>
        <extrudeGeometry
          args={[silver, { depth: 0.032, bevelEnabled: false, curveSegments: 12 }]}
        />
        <ToonMaterial color="#b8cbca" />
      </mesh>
    </group>
  );
}
