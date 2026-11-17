import { ToonMaterial } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Thin bookmatched timber facings follow the shoulders and meet the bottom
// rail. Narrow open joints reveal the continuous darker frame underneath.
function crownSegment(start: number, end: number) {
  const shape = new Shape();
  shape.absarc(0, 0.78, 0.264, start, end, false);
  shape.absarc(0, 0.78, 0.238, end, start, true);
  shape.closePath();
  return shape;
}
function rail(x: number, y: number, w: number, h: number) {
  const shape = new Shape();
  shape.moveTo(x, y);
  shape.lineTo(x + w, y);
  shape.lineTo(x + w, y + h);
  shape.lineTo(x, y + h);
  shape.closePath();
  return shape;
}
const shoulders = [0, 1, 2].map((i) =>
  crownSegment((i * Math.PI) / 3 + 0.003, ((i + 1) * Math.PI) / 3 - 0.003),
);
const facings = [
  [shoulders[0], shoulders[2], rail(-0.264, 0.036, 0.026, 0.743), rail(0.238, 0.036, 0.026, 0.743)],
  [shoulders[1], rail(-0.264, 0.005, 0.528, 0.029)],
].map((parts) => {
  const cut = parts.map(
    (shape) =>
      new ExtrudeGeometry(shape, {
        depth: 0.004,
        bevelEnabled: true,
        bevelSize: 0.0007,
        bevelThickness: 0.0007,
        bevelSegments: 1,
        curveSegments: 8,
      }),
  );
  const geometry = mergeGeometries(cut);
  cut.forEach((g) => g.dispose());
  return geometry;
});
export function MirrorFaceJoinery() {
  return facings.map((geometry, i) => (
    <mesh
      key={i}
      name="mirror-timber-facing"
      geometry={geometry}
      dispose={null}
      position-z={0.0253}
      castShadow
      receiveShadow
    >
      <ToonMaterial color={i === 0 ? "#956c4f" : "#9a7254"} />
    </mesh>
  ));
}
