import { oakGrainTexture } from "../construction/oak-grain-texture";
import {
  CabinetPiece,
  cabinetBoard,
  horizontalTimber,
  joinCabinetParts,
} from "../construction/cabinet-joinery";

const back = cabinetBoard(0.638, 2.13, 0.032, 0, 1.075, -0.174);
const uprights = joinCabinetParts(
  [-1, 1].map((side) => cabinetBoard(0.045, 2.15, 0.38, side * 0.3375, 1.075, 0, 0.007)),
);
const base = cabinetBoard(0.637, 0.6, 0.307, 0, 0.343, 0.002);
const toe = cabinetBoard(0.63, 0.046, 0.28, 0, 0.023, -0.01);
const door = cabinetBoard(0.616, 0.573, 0.028, 0, 0.342, 0.168, 0.007);
const shelves = [0.72, 1.08, 1.44, 1.8, 2.12];
const boards = horizontalTimber(
  joinCabinetParts(shelves.map((y) => cabinetBoard(0.64, 0.035, 0.353, 0, y, 0.004))),
);
const lips = joinCabinetParts(
  shelves.map((y) => cabinetBoard(0.629, 0.028, 0.013, 0, y - 0.004, 0.181)),
);
const cleats = joinCabinetParts(
  shelves.flatMap((y) =>
    [-1, 1].map((side) => cabinetBoard(0.024, 0.023, 0.265, side * 0.308, y - 0.028, -0.01)),
  ),
);
const grooves = joinCabinetParts(
  [-0.208, -0.104, 0, 0.104, 0.208].map((x) =>
    cabinetBoard(0.003, 1.49, 0.004, x, 1.39, -0.158, 0.001),
  ),
);
const handle = joinCabinetParts([
  ...[-0.034, 0.034].map((dy) => cabinetBoard(0.018, 0.014, 0.025, 0.241, 0.34 + dy, 0.191)),
  cabinetBoard(0.019, 0.086, 0.014, 0.241, 0.34, 0.206),
]);

export function OpenShelfCloset() {
  return (
    <group name="placard-etageres-couloir-custom" userData={{ walkCollider: true }}>
      <CabinetPiece geometry={back} color="#e9e5df" />
      <CabinetPiece geometry={grooves} color="#d7d2c9" />
      <CabinetPiece geometry={uprights} color="#eeeae5" outline="#aaa298" />
      <CabinetPiece geometry={base} color="#d1c9bf" />
      <CabinetPiece geometry={toe} color="#c6c0b7" />
      <CabinetPiece geometry={door} color="#ebe7e1" outline="#b1a99e" />
      <CabinetPiece geometry={boards} map={oakGrainTexture} color="#c99f72" />
      <CabinetPiece geometry={lips} color="#c0966b" />
      <CabinetPiece geometry={cleats} color="#af8962" />
      <CabinetPiece geometry={handle} color="#9c8b78" />
    </group>
  );
}
