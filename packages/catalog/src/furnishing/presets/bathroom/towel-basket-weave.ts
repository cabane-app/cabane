import { LatheGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Squared oval hoops are laid around a tapered basket. Slight undulations pass
// over alternate uprights in opposite phases on adjacent courses.
function course(profile: number[][], phase?: number) {
  const geo = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    32,
  );
  const points = geo.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i),
      z = points.getZ(i),
      angle = Math.atan2(x, z);
    const radius = Math.hypot(x, z);
    const ripple = phase === undefined ? 1 : 1 + 0.009 * Math.cos(12 * angle + phase);
    points.setXYZ(
      i,
      0.19 * radius * Math.sign(x) * Math.abs(Math.sin(angle)) ** 0.42 * ripple,
      points.getY(i),
      0.005 + 0.155 * radius * Math.sign(z) * Math.abs(Math.cos(angle)) ** 0.42 * ripple,
    );
  }
  geo.computeVertexNormals();
  return geo;
}
export const wickerShell = course([
  [0, 0],
  [0.8, 0],
  [0.84, 0.012],
  [0.967, 0.217],
  [0.937, 0.222],
  [0.785, 0.02],
  [0, 0.02],
]);
export const boundRim = course([
  [0.957, 0.213],
  [0.99, 0.216],
  [1, 0.222],
  [1, 0.234],
  [0.985, 0.24],
  [0.949, 0.24],
  [0.933, 0.235],
  [0.933, 0.219],
  [0.957, 0.213],
]);
const strips = Array.from({ length: 8 }, (_, i) => {
  const y = 0.027 + i * 0.024,
    r = 0.855 + i * 0.015;
  return course(
    [
      [r - 0.012, y],
      [r + 0.003, y + 0.002],
      [r + 0.009, y + 0.009],
      [r + 0.003, y + 0.015],
      [r - 0.009, y + 0.016],
    ],
    i * Math.PI,
  );
});
export const wickerCourses = mergeGeometries(strips);
strips.forEach((part) => part.dispose());
