import { cabinetBoard, horizontalTimber, joinCabinetParts } from "../construction/cabinet-joinery";

/** These wall units face +X, with the grain following the longer Z edge. */
export function shelfBoards(tiers: readonly (readonly [number, number])[]) {
  return joinCabinetParts(
    tiers.map(([y, z]) =>
      horizontalTimber(cabinetBoard(0.58, 0.045, 0.298, 0, 0, 0, 0.007))
        .rotateY(Math.PI / 2)
        .translate(0.001, y - 0.0005, z),
    ),
  );
}
