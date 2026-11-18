import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../../construction/cabinet-joinery";
import { WovenInset } from "./woven-inset";

const nominalWidth = 0.75;
const nominalHeight = 2.07;
const innerWidth = nominalWidth * 0.83;
const stile = (nominalWidth - innerWidth) / 2;
const rail = 0.082;
const middle = 0.97;

// The solid stiles and rails stand proud of the cane fixed into their rebate.
const frame = joinCabinetParts([
  ...[-1, 1].map((side) =>
    cabinetBoard(
      stile,
      nominalHeight,
      0.043,
      (side * (nominalWidth - stile)) / 2,
      nominalHeight / 2,
      0,
    ),
  ),
  ...[rail / 2, nominalHeight - rail / 2].map((y) =>
    cabinetBoard(innerWidth + 0.002, rail, 0.041, 0, y, 0),
  ),
  cabinetBoard(innerWidth + 0.002, 0.115, 0.041, 0, middle, 0),
]);

export function CaneDoor({
  width,
  height,
  frontZ,
}: {
  width: number;
  height: number;
  frontZ: number;
}) {
  return (
    <group position={[0, 0, frontZ]} scale={[width / nominalWidth, height / nominalHeight, 1]}>
      <CabinetPiece geometry={frame} color="#e7ddd5" />
      <WovenInset
        width={innerWidth + 0.002}
        height={middle - 0.056 - rail}
        y={(rail + middle - 0.056) / 2}
        z={0.009}
      />
      <WovenInset
        width={innerWidth + 0.002}
        height={nominalHeight - rail - middle - 0.056}
        y={(nominalHeight - rail + middle + 0.056) / 2}
        z={0.009}
      />
    </group>
  );
}
