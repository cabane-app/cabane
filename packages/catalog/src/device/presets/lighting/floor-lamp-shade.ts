import { Float32BufferAttribute, LatheGeometry, Vector2 } from "three";

// Radius, height, fold depth and linen tone. The folded panel is sewn between rolled hems.
const profile = [
  [0.316, 1.356, 0, 0.76],
  [0.323, 1.354, 0, 0.78],
  [0.326, 1.358, 0, 0.88],
  [0.326, 1.365, 0, 0.92],
  [0.323, 1.372, 0.35, 0.96],
  [0.32, 1.38, 1, 1],
  [0.206, 1.772, 1, 1],
  [0.203, 1.782, 0.35, 0.97],
  [0.205, 1.786, 0, 0.91],
  [0.204, 1.793, 0, 0.89],
  [0.2, 1.796, 0, 0.86],
  [0.194, 1.791, 0, 0.78],
] as const;

export function makeFloorLampShade() {
  const segments = 96;
  const geometry = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
  const positions = geometry.getAttribute("position");
  const colors = [];
  for (let side = 0; side <= segments; side++) {
    const angle = (side * 2 * Math.PI) / segments;
    const fold = (1 - Math.cos(24 * angle)) / 2;
    for (const [i, [radius, y, depth, tone]] of profile.entries()) {
      const r = radius - fold * depth * 0.009;
      positions.setXYZ(side * profile.length + i, Math.sin(angle) * r, y, Math.cos(angle) * r);
      const transmission = tone * (1 - fold * depth * 0.18);
      colors.push(transmission, transmission, transmission);
    }
  }
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}
