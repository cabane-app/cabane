import { BufferGeometry, Float32BufferAttribute } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

// Horizontal sections describe the stuffed pad: slight tuck at the seat, full
// shoulders, and a sloping crown that leans back against the timber frame.
function cushionGeometry() {
  const rings = [
    [0.621, 0.322, 0.058],
    [0.64, 0.371, 0.085],
    [0.676, 0.395, 0.108],
    [0.742, 0.405, 0.125],
    [0.814, 0.404, 0.134],
    [0.884, 0.4, 0.127],
    [0.956, 0.399, 0.116],
    [1.038, 0.4, 0.111],
    [1.139, 0.39, 0.103],
    [1.197, 0.371, 0.086],
    [1.219, 0.341, 0.061],
    [1.227, 0.306, 0.038],
  ];
  const points: number[] = [],
    faces: number[] = [];
  const sides = 40;
  for (const [y, width, depth] of rings) {
    const center = -0.195 - (y - 0.621) * 0.19;
    for (let k = 0; k < sides; k++) {
      const theta = (k * 2 * Math.PI) / sides;
      const c = Math.cos(theta),
        s = Math.sin(theta);
      const x = width * Math.sign(c) * Math.abs(c) ** 0.5;
      const front = Math.sign(s) * Math.abs(s) ** 0.5;
      const tuck =
        0.018 *
        Math.exp(-((Math.abs(x) - 0.19) ** 2 / 0.003 + (y - 0.888) ** 2 / 0.005)) *
        Math.max(0, front);
      points.push(x, y, center + depth * front - tuck);
    }
  }
  for (let j = 0; j < rings.length - 1; j++)
    for (let k = 0; k < sides; k++) {
      const a = j * sides + k,
        b = j * sides + ((k + 1) % sides);
      faces.push(a, a + sides, b, b, a + sides, b + sides);
    }
  const last = sides * (rings.length - 1);
  for (let k = 1; k < sides - 1; k++) faces.push(0, k, k + 1, last, last + k + 1, last + k);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points, 3));
  g.setIndex(faces);
  g.computeVertexNormals();
  return g;
}
const cushion = cushionGeometry();

export function SectionalBackCushion({ x, color }: { x: number; color: string }) {
  return (
    <mesh
      name="sectional-back-cushion"
      geometry={cushion}
      position={[x, 0, 0]}
      castShadow
      receiveShadow
    >
      <ToonMaterial color={color} />
      <Outlines color="#958775" thickness={0.0015} screenspace={false} />
    </mesh>
  );
}
