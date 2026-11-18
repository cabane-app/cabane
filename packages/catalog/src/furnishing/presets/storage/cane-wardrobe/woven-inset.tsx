import { BufferGeometry, Float32BufferAttribute } from "three";
import { CabinetPiece, cabinetBoard } from "../../construction/cabinet-joinery";

// Paired bias reeds in a square field. Crossing alternate courses lifts each
// ribbon above its neighbour; the opposing family dips at the same crossing.
function reedCourse(direction: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const pitch = 1 / 9;
  for (let course = -9; course <= 9; course++) {
    for (const offset of [-0.009, 0.009]) {
      const intercept = course * pitch + offset;
      const start = Math.max(-0.5, -0.5 - intercept);
      const end = Math.min(0.5, 0.5 - intercept);
      if (end <= start) continue;
      const steps = Math.ceil((end - start) / (pitch / 2));
      let index = vertices.length / 3;
      for (let i = 0; i <= steps; i++) {
        const x = start + ((end - start) * i) / steps;
        const y = direction * (x + intercept);
        const lift = direction * 0.0016 * Math.cos(Math.PI * ((2 * x) / pitch));
        for (const edge of [-0.004, 0.004]) {
          vertices.push(x, Math.max(-0.5, Math.min(0.5, y + edge)), 0.0023 + lift);
        }
        if (i < steps) indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
        index += 2;
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const warp = reedCourse(1);
const weft = reedCourse(-1);
const backing = cabinetBoard(1, 1, 0.012, 0, 0, -0.006);

export function WovenInset({
  width,
  height,
  y,
  z,
}: {
  width: number;
  height: number;
  y: number;
  z: number;
}) {
  return (
    <group position={[0, y, z]} scale={[width, height, 1]}>
      <CabinetPiece geometry={backing} color="#b58f66" />
      <CabinetPiece geometry={warp} color="#dabc96" />
      <CabinetPiece geometry={weft} color="#cba97f" />
    </group>
  );
}
