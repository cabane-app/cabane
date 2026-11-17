import { LatheGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cord, DiningOakMesh, timber } from "./dining-construction";

import { tableAprons } from "./table-aprons";

const top = new LatheGeometry(
  [
    [0, 0.728],
    [0.571, 0.728],
    [0.591, 0.733],
    [0.599, 0.744],
    [0.6, 0.752],
    [0.598, 0.757],
    [0.592, 0.761],
    [0, 0.761],
  ].map((p) => new Vector2(...p)),
  64,
);
const members = [-1, 1].flatMap((x) =>
  [-1, 1].map((z) =>
    timber([x * 0.382, 0, z * 0.332], [x * 0.322, 0.737, z * 0.272], 0.017, 0.032),
  ),
);
const frame = mergeGeometries(members);
members.forEach((g) => g.dispose());
// A handful of long, quiet grain strokes follow the timber instead of concentric rings.
const strokes = [-0.42, -0.29, -0.13, 0.09, 0.26, 0.41].map((z, i) => {
  const half = Math.sqrt(0.576 ** 2 - z * z);
  return cord(
    [
      [-half, 0.7622, z],
      [-half * 0.5, 0.7622, z + 0.005 * Math.sin(i)],
      [0, 0.7622, z - 0.004],
      [half * 0.5, 0.7622, z + 0.003],
      [half, 0.7622, z],
    ],
    0.0006,
    20,
  );
});
const grain = mergeGeometries(strokes);
strokes.forEach((g) => g.dispose());
export function CustomDiningTable() {
  return (
    <group name="thin-rounded-oak-dining-table">
      <DiningOakMesh name="tapered-table-legs" geometry={frame} color="#af7f49" />
      <DiningOakMesh name="arched-oak-aprons" geometry={tableAprons} color="#af7f49" />
      <DiningOakMesh name="soft-bevel-solid-oak-top" geometry={top} color="#b48650" />
      <DiningOakMesh
        name="subtle-longitudinal-oak-grain"
        geometry={grain}
        color="#9e743f"
        outline={false}
      />
    </group>
  );
}
