import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";
import { seatedBears } from "./shelf-plush";
import { shelfBoards } from "./wall-shelf-boards";

const tiers = [
  [0, 0],
  [0.36, 0.15],
  [0.72, 0.3],
] as const;
const boards = shelfBoards(tiers);
// Twin continuous mounting standards pass through all three treads.
const standards = joinCabinetParts(
  [0.035, 0.24].map((z) => cabinetBoard(0.026, 0.81, 0.032, -0.137, 0.396, z, 0.005)),
);
const lips = joinCabinetParts(
  tiers.map(([y, z]) => cabinetBoard(0.019, 0.025, 0.552, 0.13, y + 0.03, z, 0.006)),
);
const toyColors = [["#d79d9c"], ["#e3c0b2"], ["#9eafa2", "#d6a06c"]];

const bears = seatedBears(
  tiers.flatMap(([y, z], tier) =>
    toyColors[tier].map((color, i) => ({
      color,
      position: [0.068, y + 0.022, z + (i === 0 ? -0.13 : 0.13)] as [number, number, number],
    })),
  ),
);

export function ThreeTierWallShelves() {
  return (
    <group name="etageres-murales-bedroom-three-photo">
      <CabinetPiece geometry={boards} color="#bd895d" map={oakGrainTexture} outline="#806047" />
      <CabinetPiece name="three-tier-wall-standards" geometry={standards} color="#967355" />
      <CabinetPiece geometry={lips} color="#c99b6d" />
      {bears}
    </group>
  );
}
