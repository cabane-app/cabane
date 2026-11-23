import { BufferGeometry, Float32BufferAttribute, Shape } from "three";

export const roundedDioramaShape = (
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  radius: number,
) => {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const near = centerZ - depth / 2;
  const far = centerZ + depth / 2;
  const shape = new Shape();
  shape.moveTo(left + radius, -near);
  shape.lineTo(right - radius, -near);
  shape.quadraticCurveTo(right, -near, right, -near - radius);
  shape.lineTo(right, -far + radius);
  shape.quadraticCurveTo(right, -far, right - radius, -far);
  shape.lineTo(left + radius, -far);
  shape.quadraticCurveTo(left, -far, left, -far + radius);
  shape.lineTo(left, -near - radius);
  shape.quadraticCurveTo(left, -near, left + radius, -near);
  shape.closePath();
  return shape;
};

/** Feather only the exterior perimeter, leaving basement, pool and stair holes clear. */
export function plinthContactShadow(width: number, depth: number, radius = 0.42) {
  const spread = Math.min(1.5, Math.max(0.55, Math.min(width, depth) * 0.065));
  const bands = [
    [0, 0.37],
    [0.12, 0.23],
    [0.36, 0.11],
    [0.68, 0.027],
    [1, 0],
  ];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const [band, [fraction, alpha]] of bands.entries()) {
    const inset = spread * fraction;
    const outline = roundedDioramaShape(
      0,
      0,
      width + 2 * inset,
      depth + 2 * inset,
      radius === 0 ? 0 : radius + inset,
    );
    const points = outline.getPoints(12).slice(0, -1);
    for (const [i, point] of points.entries()) {
      positions.push(point.x, 0, -point.y);
      colors.push(1, 1, 1, alpha);
      if (band === 0) continue;
      const inner = (band - 1) * points.length;
      const outer = band * points.length;
      const next = (i + 1) % points.length;
      indices.push(inner + i, inner + next, outer + next, inner + i, outer + next, outer + i);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  return geometry;
}
