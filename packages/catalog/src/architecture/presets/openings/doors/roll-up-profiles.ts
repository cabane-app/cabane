import { ExtrudeGeometry, Shape } from "three";

// A horizontal extrusion. Coordinates in the section are [height, depth].
function railProfile(width: number, section: number[][]) {
  const shape = new Shape();
  section.forEach(([y, z], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2).rotateY(Math.PI / 2);
  geometry.userData.preservePlanarFaces = true;
  return geometry;
}

/** Interlocking rolled edges and a shallow pressed bead catch light on both faces. */
export function rollUpSlatGeometry(width: number, pitch: number, grainOffset: number) {
  const face = [
    [-0.5, 0.014],
    [-0.46, 0.02],
    [-0.41, 0.0225],
    [-0.18, 0.0225],
    [-0.14, 0.019],
    [-0.09, 0.019],
    [-0.05, 0.0225],
    [0.41, 0.0225],
    [0.46, 0.018],
    [0.5, 0.014],
  ].map(([y, z]) => [y * pitch, z]);
  const geometry = railProfile(width, [...face, ...face.map(([y, z]) => [y, -z]).reverse()]);
  const pos = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getY(i) / 0.86 + grainOffset, pos.getX(i) / 1.86 + grainOffset);
  }
  return geometry;
}

/** A folded cassette with a sloping return where the moving curtain enters. */
export function rollUpHoodGeometry(width: number, height: number, depth: number) {
  const y = height / 2,
    z = depth / 2,
    bevel = Math.min(0.032, z / 3, y / 2);
  return railProfile(width, [
    [-y, -z + bevel],
    [-y + bevel, -z],
    [y - bevel / 4, -z],
    [y, -z + bevel / 4],
    [y, z - bevel / 4],
    [y - bevel / 4, z],
    [-y + bevel, z],
    [-y, z - bevel],
  ]);
}
