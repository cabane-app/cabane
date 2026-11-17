import { ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// A shallow arch leaves a full-height shoulder where the rail meets each leg.
function apron(halfSpan: number) {
  const rail = new Shape();
  rail.moveTo(-halfSpan, 0.733);
  rail.lineTo(-halfSpan, 0.657);
  rail.bezierCurveTo(-halfSpan * 0.55, 0.663, -halfSpan * 0.4, 0.686, 0, 0.686);
  rail.bezierCurveTo(halfSpan * 0.4, 0.686, halfSpan * 0.55, 0.663, halfSpan, 0.657);
  rail.lineTo(halfSpan, 0.733);
  rail.closePath();
  const g = new ExtrudeGeometry(rail, {
    depth: 0.023,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 6,
  });
  return g.translate(0, 0, -0.0115);
}
const rails = [-1, 1].flatMap((s) => [
  apron(0.323).translate(0, 0, s * 0.274),
  apron(0.274)
    .rotateY(Math.PI / 2)
    .translate(s * 0.323, 0, 0),
]);
export const tableAprons = mergeGeometries(rails);
rails.forEach((g) => g.dispose());
