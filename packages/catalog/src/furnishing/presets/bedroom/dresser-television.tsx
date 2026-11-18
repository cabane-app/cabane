import { BoxGeometry, Shape, ShapeGeometry } from "three";
import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";

const foot = cabinetBoard(0.47, 0.026, 0.204, 0, 0.013, 0, 0.009);
const pedestal = cabinetBoard(0.087, 0.189, 0.058, 0, 0.111, -0.009, 0.009);
const housing = cabinetBoard(0.9, 0.535, 0.05, 0, 0.3925, 0, 0.014);
const screen = cabinetBoard(0.864, 0.489, 0.006, 0, 0.396, 0.026, 0.003);
const hump = cabinetBoard(0.654, 0.269, 0.04, 0, 0.329, -0.041, 0.014);
const vents = joinCabinetParts(
  Array.from({ length: 23 }, (_, index) =>
    new BoxGeometry(0.011, 0.036, 0.002).translate((index - 11) * 0.022, 0.404, -0.0611),
  ),
);
const chin = cabinetBoard(0.801, 0.009, 0.006, 0, 0.138, 0.025);
const badge = cabinetBoard(0.044, 0.006, 0.004, 0, 0.138, 0.028);
// A broad off-screen reflection on the powered-down glass.
const glint = new Shape();
glint.moveTo(-0.411, 0.621);
glint.lineTo(-0.273, 0.621);
glint.lineTo(-0.411, 0.478);
glint.closePath();
const reflection = new ShapeGeometry(glint).translate(0, 0, 0.0297);

export function DresserTelevision() {
  return (
    <group name="television-parentale-custom" position={[0, 0.86, 0.035]}>
      <CabinetPiece geometry={foot} color="#242526" />
      <CabinetPiece geometry={pedestal} color="#303235" />
      <CabinetPiece geometry={housing} color="#1b1d20" outline="#13191e" />
      <CabinetPiece geometry={hump} color="#303235" />
      <CabinetPiece geometry={vents} color="#202428" />
      <CabinetPiece geometry={screen} color="#17232d" />
      <CabinetPiece geometry={reflection} color="#1b2832" />
      <CabinetPiece geometry={chin} color="#3e4245" />
      <CabinetPiece geometry={badge} color="#aeb4b7" />
    </group>
  );
}
