import { Outlines, ToonMaterial } from "@cabane/engine";
import { Shape } from "three";

const front = new Shape();
front.moveTo(-0.19, -0.078);
front.lineTo(0.19, -0.078);
front.lineTo(0.19, 0.078);
front.lineTo(0.08, 0.078);
front.bezierCurveTo(0.054, 0.078, 0.059, 0.043, 0.029, 0.043);
front.lineTo(-0.029, 0.043);
front.bezierCurveTo(-0.059, 0.043, -0.054, 0.078, -0.08, 0.078);
front.lineTo(-0.19, 0.078);
front.closePath();
const options = {
  depth: 0.023,
  curveSegments: 8,
  bevelEnabled: true,
  bevelSegments: 2,
  bevelSize: 0.003,
  bevelThickness: 0.003,
};

export function NightstandDrawer() {
  return (
    <group position-y={0.376}>
      <mesh position={[0, -0.016, 0.013]} castShadow>
        <boxGeometry args={[0.378, 0.13, 0.298]} />
        <ToonMaterial color="#a88860" />
      </mesh>
      <mesh name="nightstand-drawer" position-z={0.163} castShadow receiveShadow>
        <extrudeGeometry args={[front, options]} />
        <ToonMaterial color="#d6b584" />
        <Outlines color="#aa8d68" thickness={0.0015} screenspace={false} />
      </mesh>
    </group>
  );
}
