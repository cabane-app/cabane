import { ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { timber } from "../dining-room/photo-dining-set/dining-construction";

const framePieces = [-1, 1].flatMap((x) => [
  ...[-1, 1].map((z) =>
    timber([x * 0.207, 0, z * 0.213], [x * 0.17, 0.615, z * 0.157], 0.014, 0.023),
  ),
  timber([x * 0.17, 0.6, -0.157], [x * 0.174, 0.852, -0.202], 0.019, 0.015),
]);
export const stoolFrame = mergeGeometries(framePieces);
framePieces.forEach((piece) => piece.dispose());

// Rails meet the splayed legs at their interpolated centers.
const railPieces = [-1, 1].flatMap((side) => [
  timber([side * 0.192, 0.255, -0.19], [side * 0.192, 0.255, 0.19], 0.011),
  timber([-0.194, 0.223, side * 0.193], [0.194, 0.223, side * 0.193], 0.014),
]);
export const stoolFootrails = mergeGeometries(railPieces);
railPieces.forEach((piece) => piece.dispose());

const back = new Shape();
back.moveTo(-0.226, -0.126);
back.quadraticCurveTo(-0.19, -0.246, 0, -0.246);
back.quadraticCurveTo(0.19, -0.246, 0.226, -0.126);
back.quadraticCurveTo(0.23, -0.1, 0.21, -0.12);
back.quadraticCurveTo(0.157, -0.226, 0, -0.226);
back.quadraticCurveTo(-0.157, -0.226, -0.21, -0.12);
back.quadraticCurveTo(-0.23, -0.1, -0.226, -0.126);
export const stoolBentBack = new ExtrudeGeometry(back, {
  depth: 0.088,
  curveSegments: 9,
  bevelEnabled: true,
  bevelSegments: 2,
  bevelSize: 0.004,
  bevelThickness: 0.004,
});
stoolBentBack.rotateX(Math.PI / 2);
