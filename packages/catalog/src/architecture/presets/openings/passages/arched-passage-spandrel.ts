import { Shape } from "three";

export const archedPassageCurve = (
  opening: { openingHeightMeters: number; archRiseMeters: number },
  widthMeters: number,
) => {
  const spring = opening.openingHeightMeters - opening.archRiseMeters;
  const shape = new Shape();
  shape.moveTo(0, spring);
  shape.quadraticCurveTo(
    widthMeters * 0.22,
    opening.openingHeightMeters,
    widthMeters / 2,
    opening.openingHeightMeters,
  );
  shape.quadraticCurveTo(widthMeters * 0.78, opening.openingHeightMeters, widthMeters, spring);
  return shape;
};

export const buildArchedPassageSpandrelShape = (
  opening: { openingHeightMeters: number; archRiseMeters: number },
  widthMeters: number,
) => {
  const shape = archedPassageCurve(opening, widthMeters);
  shape.lineTo(widthMeters, opening.openingHeightMeters);
  shape.lineTo(0, opening.openingHeightMeters);
  shape.closePath();
  return shape;
};
