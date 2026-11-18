import { Outlines, ToonMaterial } from "@cabane/engine";
import { Path, Shape } from "three";

// The low left shoulder and high right shoulder share a continuous tangent.
function pebble(scale: number) {
  const s = new Shape();
  s.moveTo(-0.375, -0.09);
  s.bezierCurveTo(-0.375, 0.19, -0.185, 0.545, 0.063, 0.545);
  s.bezierCurveTo(0.245, 0.545, 0.375, 0.304, 0.375, 0.16);
  s.bezierCurveTo(0.375, -0.137, 0.231, -0.545, -0.058, -0.545);
  s.bezierCurveTo(-0.24, -0.545, -0.375, -0.33, -0.375, -0.09);
  return s.getPoints(8).map((point) => point.multiplyScalar(scale));
}
const frame = new Shape(pebble(1));
frame.holes.push(new Path(pebble(0.922)));
const face = new Shape(pebble(0.932));

export function OrganicWallMirror() {
  return (
    <group name="miroir-organique-couloir-custom">
      <mesh name="pebble-frame" position-z={-0.03} castShadow>
        <extrudeGeometry
          args={[frame, { depth: 0.08, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1 }]}
        />
        <ToonMaterial color="#8e8981" />
        <Outlines thickness={0.0015} color="#675f58" screenspace={false} />
      </mesh>
      <mesh name="recessed-mirror-face" position-z={0.029}>
        <extrudeGeometry args={[face, { depth: 0.013, bevelEnabled: false }]} />
        <ToonMaterial color="#9fb2b5" emissive="#dce7e8" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}
