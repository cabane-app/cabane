import { Outlines, ToonMaterial } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";

// Horizontal courses through the mould, measured from the center of the bath.
// The asymmetric inner courses give the reclining end a longer slope.
type Course = [halfLength: number, halfWidth: number, radius: number, y: number, centerX?: number];

function roundedCourse([x, z, r, y, cx = 0]: Course) {
  return [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].flatMap(([sx, sz], corner) =>
    Array.from({ length: 7 }, (_, step) => {
      const angle = ((corner + step / 6) * Math.PI) / 2;
      return [cx + sx * (x - r) + r * Math.cos(angle), y, sz * (z - r) + r * Math.sin(angle)];
    }),
  );
}

function bathGeometry(courses: Course[]) {
  const rings = courses.map(roundedCourse);
  const count = rings[0].length;
  const positions = rings.flat().flat();
  const indices: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < count; j++) {
      const lower = i * count + j,
        next = i * count + ((j + 1) % count);
      indices.push(lower, lower + count, next, next, lower + count, next + count);
    }
  }
  // Finish the level floor inside the bowl. The underside rests on the floor.
  const last = (rings.length - 1) * count;
  for (let j = 1; j < count - 1; j++) indices.push(last, last + j + 1, last + j);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const shell = bathGeometry([
  [0.783, 0.352, 0.028, 0],
  [0.783, 0.352, 0.028, 0.038],
  [0.807, 0.379, 0.034, 0.053],
  [0.812, 0.382, 0.039, 0.067],
  [0.812, 0.382, 0.039, 0.48],
  [0.813, 0.383, 0.04, 0.509],
  [0.82, 0.39, 0.044, 0.521],
  [0.82, 0.39, 0.044, 0.548],
  [0.817, 0.387, 0.046, 0.559],
  [0.809, 0.379, 0.05, 0.565],
  [0.75, 0.299, 0.145, 0.565],
  [0.739, 0.29, 0.148, 0.558],
  [0.727, 0.284, 0.149, 0.54],
  [0.7, 0.277, 0.147, 0.47, 0.012],
  [0.596, 0.242, 0.145, 0.232, 0.057],
  [0.562, 0.23, 0.14, 0.18, 0.07],
  [0.525, 0.212, 0.126, 0.151, 0.079],
  [0.478, 0.184, 0.11, 0.138, 0.087],
  [0.438, 0.158, 0.102, 0.136, 0.087],
]);
// At 20 cm the water meets the sloping glaze around its entire perimeter.
const water = bathGeometry([[0.578, 0.237, 0.142, 0.2, 0.065]]);

export function FamilyBathShell() {
  return (
    <>
      <mesh geometry={shell} castShadow receiveShadow>
        <ToonMaterial color="#eeeae3" />
        <Outlines color="#b4b0a9" thickness={0.0014} screenspace={false} />
      </mesh>
      <mesh geometry={water} receiveShadow>
        <ToonMaterial color="#c7d9d9" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0.43, 0.139, 0]}>
        <cylinderGeometry args={[0.03, 0.034, 0.006, 20]} />
        <ToonMaterial color="#99a3a0" />
      </mesh>
    </>
  );
}
