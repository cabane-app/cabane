import { CylinderGeometry, ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const spindles = Array.from({ length: 15 }, (_, index) => {
  const spindle = new CylinderGeometry(0.01, 0.012, 0.549, 10);
  spindle.translate(0, 0.585, (index - 7) * 0.087);
  return spindle;
});
export const cribSpindles = mergeGeometries(spindles);
spindles.forEach((spindle) => spindle.dispose());

// One continuous end panel, with an arched crest and a swept cutaway below.
const end = new Shape();
end.moveTo(-0.346, 0.238);
end.quadraticCurveTo(0, 0.315, 0.346, 0.238);
end.lineTo(0.346, 0.857);
end.bezierCurveTo(0.226, 0.866, 0.202, 0.945, 0, 0.945);
end.bezierCurveTo(-0.202, 0.945, -0.226, 0.866, -0.346, 0.857);
end.closePath();
export const cribEnd = new ExtrudeGeometry(end, {
  depth: 0.04,
  curveSegments: 8,
  bevelEnabled: true,
  bevelSegments: 1,
  bevelSize: 0.005,
  bevelThickness: 0.005,
});
