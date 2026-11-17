import { CylinderGeometry, LatheGeometry, Vector2, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Two through-bolted round pulls on the pane, within the original sweep depth. */
export function glassPullGeometry() {
  const parts: BufferGeometry[] = [];
  const profile = [
    [0, -0.152],
    [0.009, -0.152],
    [0.012, -0.149],
    [0.012, 0.149],
    [0.009, 0.152],
    [0, 0.152],
  ].map(([r, y]) => new Vector2(r, y));
  for (const side of [-1, 1]) {
    parts.push(new LatheGeometry(profile, 16).translate(0, 0, side * 0.071));
    for (const height of [-0.104, 0.104]) {
      parts.push(
        new CylinderGeometry(0.009, 0.009, 0.057, 12)
          .rotateX(Math.PI / 2)
          .translate(0, height, side * 0.0415),
      );
      parts.push(
        new CylinderGeometry(0.021, 0.021, 0.006, 20)
          .rotateX(Math.PI / 2)
          .translate(0, height, side * 0.015),
      );
    }
  }
  const result = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  result.userData.preservePlanarFaces = true;
  return result;
}
