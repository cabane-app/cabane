import { OakVeneerMaterial } from "../construction/oak-veneer";
import { type SceneItemSize } from "@cabane/engine";
import { Shape, Path } from "three";
import { RoundedFurniturePanel as Panel } from "../construction";
export const LOW_MEDIA_CONSOLE_SIZE = [1.6, 0.55, 0.42] as const;
const back = new Shape();
back.moveTo(-0.775, 0.09);
back.lineTo(0.775, 0.09);
back.lineTo(0.775, 0.525);
back.lineTo(-0.775, 0.525);
back.closePath();
const port = new Path();
port.absarc(0, 0.39, 0.033, 0, Math.PI * 2, true);
back.holes.push(port);
export function LowMediaConsole({ size = LOW_MEDIA_CONSOLE_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="low-media-console"
      scale={[size[0] / 1.6, size[1] / 0.55, size[2] / 0.42]}
      userData={{ walkCollider: true }}
    >
      {[-0.68, 0.68].flatMap((x) =>
        [-0.15, 0.15].map((z) => (
          <mesh
            key={x + ":" + z}
            position={[x, 0.042, z]}

            castShadow
          >
            <cylinderGeometry args={[0.054, 0.041, 0.084, 4, 1, false, Math.PI / 4]} />
            <OakVeneerMaterial color="#9d754c" />
          </mesh>
        )),
      )}
      <mesh position={[0, 0, -0.197]} castShadow receiveShadow>
        <extrudeGeometry args={[back, { depth: 0.014, bevelEnabled: false, curveSegments: 12 }]} />
        <OakVeneerMaterial color="#9b7a52" />
      </mesh>
      <Panel
        grain="x"
        size={[1.58, 0.044, 0.4]}
        position={[0, 0.098, 0]}
        color="#bc9665"
        outline={false}
      />
      {[-0.764, -0.268, 0.268, 0.764].map((x) => (
        <Panel
          grain="y"
          key={x}
          size={[0.035, 0.412, 0.39]}
          position={[x, 0.321, -0.004]}
          color="#c7a473"
          radius={0.004}
          outline={false}
        />
      ))}
      <Panel
        grain="x"
        size={[0.512, 0.021, 0.347]}
        position={[0, 0.292, -0.01]}
        color="#cba978"
        outline={false}
      />
      {[-0.516, 0.516].map((x) => (
        <group key={x}>
          <Panel
            name="media-console-door"
            size={[0.471, 0.391, 0.024]}
            position={[x, 0.319, 0.183]}
            color="#e5dfd2"
            radius={0.009}
            outlineColor="#b7afa1"
          />
          <Panel
            size={[0.093, 0.018, 0.017]}
            position={[x - Math.sign(x) * 0.155, 0.465, 0.201]}
            color="#a88a5a"
            radius={0.004}
            outline={false}
          />
        </group>
      ))}
      <Panel
        grain="x"
        size={[1.6, 0.03, 0.42]}
        position={[0, 0.535, 0]}
        color="#cfa873"
        radius={0.008}
        outlineColor="#a18663"
      />
    </group>
  );
}
