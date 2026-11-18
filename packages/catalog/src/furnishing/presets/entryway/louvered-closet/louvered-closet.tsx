import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../../construction/cabinet-joinery";
import { SlidingLouverPanel } from "./sliding-louver-panel";
import {
  PANEL_COUNT,
  OPENING_LENGTH,
  PANEL_WIDTH,
  PANEL_HEIGHT,
  WOOD_RECESS,
} from "./louvered-closet-finish";

const track = joinCabinetParts(
  [0.0275, PANEL_HEIGHT + 0.0275].map((y) =>
    cabinetBoard(0.075, 0.055, OPENING_LENGTH - 0.07, 0.015, y, 0),
  ),
);
const channel = cabinetBoard(0.012, 0.014, OPENING_LENGTH - 0.08, 0.051, PANEL_HEIGHT + 0.025, 0);

export function LouveredCloset() {
  const centers = Array.from({ length: PANEL_COUNT }, (_, index) => (index - 1) * PANEL_WIDTH);
  return (
    <group name="portes-coulissantes-placard-entree-custom" userData={{ walkCollider: true }}>
      <CabinetPiece geometry={track} color={WOOD_RECESS} />
      <CabinetPiece geometry={channel} color="#98784e" />
      {centers.map((z, index) => (
        <SlidingLouverPanel key={z} position={[index === 1 ? 0.018 : 0, 0, z]} />
      ))}
    </group>
  );
}
