import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bentwood, cord, DiningOakMesh, timber, WovenDiningSeat } from "./dining-construction";

const members: BufferGeometry[] = [-1, 1].flatMap((s) => [
  timber([s * 0.222, 0, 0.182], [s * 0.211, 0.671, 0.13], 0.013, 0.019),
  timber([s * 0.205, 0, -0.181], [s * 0.191, 0.748, -0.174], 0.013, 0.021),
  timber([s * 0.205, 0.425, -0.168], [s * 0.216, 0.425, 0.171], 0.019),
  timber([s * 0.212, 0.235, -0.166], [s * 0.216, 0.235, 0.163], 0.011),
]);
members.push(
  timber([-0.213, 0.425, 0.171], [0.213, 0.425, 0.171], 0.021),
  timber([-0.201, 0.425, -0.168], [0.201, 0.425, -0.168], 0.018),
  timber([-0.212, 0.255, -0.166], [0.212, 0.255, -0.166], 0.011),
  cord(
    [
      [0, 0.442, -0.17],
      [0, 0.574, -0.187],
      [-0.048, 0.67, -0.2],
      [-0.104, 0.754, -0.202],
    ],
    0.013,
    14,
  ),
  cord(
    [
      [0, 0.568, -0.187],
      [0.048, 0.67, -0.2],
      [0.104, 0.754, -0.202],
    ],
    0.013,
    10,
  ),
);
const frame = mergeGeometries(members);
members.forEach((g) => g.dispose());
const rail = bentwood();

export function CustomDiningChair({
  position,
  rotationY,
  color,
}: {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly color?: string | undefined;
}) {
  return (
    <group name="chaise-repas-cannee-custom" position={position} rotation={[0, rotationY, 0]}>
      <DiningOakMesh name="wishbone-chair-joined-frame" geometry={frame} />
      <DiningOakMesh name="continuous-bentwood-back-and-arms" geometry={rail} color="#cba16b" />
      <WovenDiningSeat color={color} />
    </group>
  );
}
