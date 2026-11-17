import { ToonMaterial } from "@cabane/engine";
import { BoxGeometry, Path, Shape } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function framedDoor(width: number, height: number, stile: number) {
  const half = width / 2,
    top = height / 2;
  const frame = new Shape();
  frame.moveTo(-half, -top);
  frame.lineTo(half, -top);
  frame.lineTo(half, top);
  frame.lineTo(-half, top);
  frame.closePath();
  const hole = new Path();
  hole.moveTo(-half + stile, -top + stile);
  hole.lineTo(-half + stile, top - stile);
  hole.lineTo(half - stile, top - stile);
  hole.lineTo(half - stile, -top + stile);
  hole.closePath();
  frame.holes.push(hole);
  return frame;
}

const slattedFrame = framedDoor(0.49, 0.616, 0.038);
const panelFrame = framedDoor(0.366, 0.657, 0.04);
const louvers = mergeGeometries(
  Array.from({ length: 8 }, (_, i) =>
    new BoxGeometry(0.42, 0.067, 0.017).rotateX(-0.27).translate(0, (i - 3.5) * 0.065, 0.005),
  ),
);
export function VanityDoor({ louvered = false, color }: { louvered?: boolean; color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <extrudeGeometry
          args={[
            louvered ? slattedFrame : panelFrame,
            {
              depth: 0.017,
              bevelEnabled: true,
              bevelSegments: 1,
              bevelSize: 0.002,
              bevelThickness: 0.002,
            },
          ]}
        />
        <ToonMaterial color={color} />
      </mesh>
      {louvered ? (
        <mesh geometry={louvers} castShadow receiveShadow>
          <ToonMaterial color="#a87550" />
        </mesh>
      ) : (
        <mesh position={[0, 0, 0.001]} receiveShadow>
          <boxGeometry args={[0.295, 0.588, 0.01]} />
          <ToonMaterial color="#493229" />
        </mesh>
      )}
    </group>
  );
}
