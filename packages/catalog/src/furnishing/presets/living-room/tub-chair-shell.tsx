import { BufferGeometry, Float32BufferAttribute } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

// A single padded horseshoe rises from the two low arm noses to a high
// continuous back. Round end sections close the exposed arm ends.
const path: { x: number; z: number; nx: number; nz: number; top: number; fullness: number }[] = [];
for (const [z, top, fullness] of [
  [0.338, 0.588, 0.32],
  [0.329, 0.606, 0.72],
  [0.3, 0.625, 1],
  [0.19, 0.644, 1],
  [0.06, 0.684, 1],
]) {
  path.push({ x: 0.315, z, nx: 1, nz: 0, top, fullness });
}
for (let i = 0; i <= 24; i++) {
  const a = (Math.PI * i) / 24;
  const nx = Math.cos(a),
    nz = -Math.sin(a);
  path.push({ x: 0.315 * nx, z: -0.04 + 0.285 * nz, nx, nz, top: 0.719 - 0.141 * nz, fullness: 1 });
}
for (const point of path.slice(0, 5).reverse()) path.push({ ...point, x: -point.x, nx: -1 });
const sides = 16;
const vertices: number[] = [],
  faces: number[] = [];
for (const { x, z, nx, nz, top, fullness } of path) {
  const bottom = 0.205;
  for (let j = 0; j < sides; j++) {
    const a = (2 * Math.PI * j) / sides;
    const c = Math.cos(a),
      s = Math.sin(a);
    const roll = 0.075 * fullness * Math.sign(c) * Math.abs(c) ** 0.65;
    const y =
      (top + bottom) / 2 + ((top - bottom) / 2) * Math.sign(s) * Math.abs(s) ** 0.66 * fullness;
    vertices.push(x + nx * roll, y, z + nz * roll);
  }
}
for (let i = 0; i < path.length - 1; i++)
  for (let j = 0; j < sides; j++) {
    const a = i * sides + j,
      b = i * sides + ((j + 1) % sides);
    faces.push(a, a + sides, b, b, a + sides, b + sides);
  }
const last = (path.length - 1) * sides;
for (let j = 1; j < sides - 1; j++) faces.push(0, j, j + 1, last, last + j + 1, last + j);
const shell = new BufferGeometry();
shell.setAttribute("position", new Float32BufferAttribute(vertices, 3));
shell.setIndex(faces);
shell.computeVertexNormals();
export function TubChairShell({ color }: { color: string }) {
  return (
    <mesh name="continuous-padded-tub" geometry={shell} dispose={null} castShadow receiveShadow>
      <ToonMaterial color={color} />
      <Outlines color="#576f61" thickness={0.0015} screenspace={false} />
    </mesh>
  );
}
