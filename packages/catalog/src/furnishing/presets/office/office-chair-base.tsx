import { CylinderGeometry } from "three";
import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";

const lift = new CylinderGeometry(0.022, 0.027, 0.29, 12).translate(0, 0.285, 0);
const hub = new CylinderGeometry(0.045, 0.057, 0.12, 12).translate(0, 0.175, 0);
const angles = Array.from({ length: 5 }, (_, i) => (i * 2 * Math.PI) / 5);
const spokes = joinCabinetParts(
  angles.map((angle) =>
    cabinetBoard(0.044, 0.035, 0.31, 0, 0, 0, 0.009)
      .rotateX(0.16)
      .translate(0, 0.115, 0.155)
      .rotateY(angle),
  ),
);
const forks = joinCabinetParts(
  angles.map((angle) => cabinetBoard(0.019, 0.072, 0.032, 0, 0.064, 0.308).rotateY(angle)),
);
const wheels = joinCabinetParts(
  angles.flatMap((angle) =>
    [-1, 1].map((side) =>
      new CylinderGeometry(0.032, 0.032, 0.022, 16)
        .rotateZ(Math.PI / 2)
        .translate(side * 0.021, 0.032, 0.308)
        .rotateY(angle),
    ),
  ),
);
const axles = joinCabinetParts(
  angles.map((angle) =>
    new CylinderGeometry(0.014, 0.014, 0.068, 12)
      .rotateZ(Math.PI / 2)
      .translate(0, 0.032, 0.308)
      .rotateY(angle),
  ),
);

/** Five swivel forks and paired floor-contact wheels. */
export function OfficeChairBase() {
  return (
    <group name="office-chair-base">
      <CabinetPiece geometry={lift} color="#777a76" />
      <CabinetPiece geometry={hub} color="#444944" />
      <CabinetPiece geometry={spokes} color="#50564f" />
      <CabinetPiece geometry={forks} color="#555b53" />
      <CabinetPiece name="wheel" geometry={wheels} color="#343934" />
      <CabinetPiece geometry={axles} color="#777a76" />
    </group>
  );
}
