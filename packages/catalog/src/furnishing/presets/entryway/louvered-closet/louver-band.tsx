import { ExtrudeGeometry, Shape } from "three";
import { CabinetPiece, joinCabinetParts } from "../../construction/cabinet-joinery";
import { PANEL_WIDTH, WOOD, WOOD_LIGHT } from "./louvered-closet-finish";

// A shaped nose and sloped upper face catch the light; the narrow heel keys
// into the recess while both ends sit under the panel stiles.
const blade = new Shape();
blade.moveTo(-0.002, 0.018);
blade.lineTo(0.01, 0.025);
blade.lineTo(0.059, 0.002);
blade.quadraticCurveTo(0.064, 0, 0.064, -0.005);
blade.lineTo(0.061, -0.013);
blade.lineTo(-0.002, 0.006);
blade.closePath();
const depth = PANEL_WIDTH - 0.13;
const levels = [
  [0.12, 10],
  [0.896, 11],
] as const;
const blades = levels.flatMap(([bottom, count]) =>
  Array.from({ length: count }, (_, i) =>
    new ExtrudeGeometry(blade, {
      depth,
      bevelEnabled: false,
      curveSegments: 2,
    }).translate(0, bottom + i * 0.063, -depth / 2),
  ),
);
const light = joinCabinetParts(blades.filter((_, i) => i % 4 === 2));
const honey = joinCabinetParts(blades.filter((_, i) => i % 4 !== 2));

export function LouverBand() {
  return (
    <group name="lames-persienne-entree">
      <CabinetPiece geometry={honey} color={WOOD} />
      <CabinetPiece geometry={light} color={WOOD_LIGHT} />
    </group>
  );
}
