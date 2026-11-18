import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../../construction/cabinet-joinery";
import { LouverBand } from "./louver-band";
import { PANEL_WIDTH, PANEL_HEIGHT, WOOD, WOOD_RECESS, WOOD_EDGE } from "./louvered-closet-finish";

const back = cabinetBoard(
  0.038,
  PANEL_HEIGHT - 0.15,
  PANEL_WIDTH - 0.11,
  -0.012,
  PANEL_HEIGHT / 2,
  0,
);
const frame = joinCabinetParts([
  ...[-1, 1].map((side) =>
    cabinetBoard(
      0.064,
      PANEL_HEIGHT,
      0.07,
      0.012,
      PANEL_HEIGHT / 2,
      side * (PANEL_WIDTH / 2 - 0.035),
    ),
  ),
  ...[0.05, PANEL_HEIGHT - 0.05].map((y) =>
    cabinetBoard(0.06, 0.1, PANEL_WIDTH - 0.137, 0.01, y, 0),
  ),
  cabinetBoard(0.065, 0.13, PANEL_WIDTH - 0.137, 0.013, 0.805, 0),
]);
const cup = cabinetBoard(0.009, 0.052, 0.122, 0.047, 0.805, 0.105, 0.004);
const recess = cabinetBoard(0.004, 0.03, 0.096, 0.052, 0.803, 0.105, 0.002);

export function SlidingLouverPanel({ position }: { position: [number, number, number] }) {
  return (
    <group name="panneau-coulissant-persienne-entree" position={position}>
      <CabinetPiece geometry={back} color={WOOD_RECESS} />
      <CabinetPiece geometry={frame} color={WOOD} outline={WOOD_EDGE} />
      <LouverBand />
      <CabinetPiece geometry={cup} color="#96794f" />
      <CabinetPiece geometry={recess} color="#705a44" />
    </group>
  );
}
