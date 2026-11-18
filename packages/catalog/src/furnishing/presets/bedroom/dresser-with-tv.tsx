import {
  CabinetPiece,
  cabinetBoard,
  horizontalTimber,
  joinCabinetParts,
} from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";
import { DresserTelevision } from "./dresser-television";

const back = cabinetBoard(1.121, 0.65, 0.459, 0, 0.42, -0.005);
const ends = joinCabinetParts(
  [-1, 1].map((side) => cabinetBoard(0.062, 0.677, 0.497, side * 0.591, 0.4345, -0.004, 0.008)),
);
const feet = joinCabinetParts(
  [-1, 1].flatMap((side) =>
    [-1, 1].map((end) => cabinetBoard(0.081, 0.109, 0.079, side * 0.576, 0.0545, end * 0.197)),
  ),
);
const apron = cabinetBoard(1.119, 0.073, 0.433, 0, 0.126, -0.004);
const top = horizontalTimber(cabinetBoard(1.32, 0.062, 0.55, 0, 0.829, 0, 0.013));
const lip = cabinetBoard(1.264, 0.045, 0.508, 0, 0.781, 0, 0.007);
const drawers = horizontalTimber(
  joinCabinetParts(
    [0.301, 0.603].map((y) => cabinetBoard(1.111, 0.286, 0.051, 0, y, 0.246, 0.008)),
  ),
);
const topEdges = joinCabinetParts(
  [0.301, 0.603].map((y) => cabinetBoard(1.064, 0.014, 0.006, 0, y + 0.12, 0.272, 0.003)),
);
const pulls = joinCabinetParts(
  [0.301, 0.603].flatMap((y) => [
    ...[-0.191, 0.191].map((x) => cabinetBoard(0.027, 0.041, 0.041, x, y + 0.023, 0.289)),
    cabinetBoard(0.415, 0.029, 0.025, 0, y + 0.023, 0.3075, 0.007),
  ]),
);

export function DresserWithTv() {
  return (
    <group name="commode-pin-et-television-parentale-custom" userData={{ walkCollider: true }}>
      <CabinetPiece geometry={back} color="#b78a5d" />
      <CabinetPiece geometry={ends} color="#c79a69" outline="#8e6847" />
      <CabinetPiece geometry={feet} color="#936942" />
      <CabinetPiece geometry={apron} color="#ac8054" />
      <CabinetPiece geometry={top} color="#c79a69" map={oakGrainTexture} outline="#886448" />
      <CabinetPiece geometry={lip} color="#aa7d54" />
      <CabinetPiece geometry={drawers} color="#c79a69" map={oakGrainTexture} />
      <CabinetPiece geometry={topEdges} color="#d0a577" />
      <CabinetPiece geometry={pulls} color="#323132" />
      <DresserTelevision />
    </group>
  );
}
