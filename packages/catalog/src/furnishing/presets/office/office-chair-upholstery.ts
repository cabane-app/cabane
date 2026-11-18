import { BoxGeometry, Float32BufferAttribute, Vector3 } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Keep vertices across the broad faces so the cushion can cup and flex between its edges. */
function cushionBlank(
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments: [number, number, number],
) {
  const box = new BoxGeometry(width, height, depth, ...segments);
  const inner = new Vector3(width / 2 - radius, height / 2 - radius, depth / 2 - radius);
  const lower = inner.clone().negate();
  const position = box.getAttribute("position");
  const point = new Vector3();
  const center = new Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    center.copy(point).clamp(lower, inner);
    point.sub(center).setLength(radius).add(center);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  // Normals are computed after molding. All faces share the same fabric projection.
  box.deleteAttribute("normal");
  box.deleteAttribute("uv");
  const geometry = mergeVertices(box);
  box.dispose();
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2),
  );
  return geometry;
}

/** Full-width radiused panels, pressed into a shallow wrap around the sitter. */
export function chairBackPanel(
  width: number,
  height: number,
  thickness: number,
  baseY: number,
  backZ: number,
) {
  const geometry = cushionBlank(width, height, 0.12, 0.052, [12, 12, 4]);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const rise = positions.getY(i) / height + 0.5;
    const wrap = (x / (width / 2)) ** 2;
    const lean = Math.min(1, rise / 0.8);
    const lumbar = 0.034 * Math.sin(Math.PI * lean) * (1 - lean);
    const z =
      backZ +
      (positions.getZ(i) / 0.12) * thickness +
      0.035 * wrap +
      lumbar -
      0.04 * lean * lean * (3 - 2 * lean);
    positions.setXYZ(i, x * (0.87 + 0.13 * Math.sin(Math.PI * rise)), baseY + rise * height, z);
    uv.setXY(i, x / 0.18, (rise * height) / 0.18);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function chairSeat() {
  const geometry = cushionBlank(0.51, 0.16, 0.49, 0.07, [12, 6, 12]);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const taper = 0.92 + 0.08 * (z / 0.49 + 0.5);
    positions.setXYZ(i, x * taper, 0.5 + y * 0.53 + 0.014 * (x / 0.255) ** 2, z + 0.025);
    uv.setXY(i, x / 0.18, (z + y * 0.5) / 0.18);
  }
  geometry.computeVertexNormals();
  return geometry;
}
