import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute, Vector2 } from "three";
export const HEXAGONAL_SIDE_TABLE_SIZE = [0.6, 0.43, 0.5196152423] as const;

// Each face has three broad coved panels. Their depth fades to zero at
// both ends, leaving solid joinery below the top and above the toe kick.
const sections = [
  [0.026, 0.275, 0],
  [0.034, 0.282, 0],
  [0.049, 0.282, 0],
  [0.071, 0.282, 0.007],
  [0.092, 0.282, 0.012],
  [0.341, 0.282, 0.012],
  [0.362, 0.282, 0.007],
  [0.382, 0.282, 0],
  [0.401, 0.282, 0],
];
const steps = 18,
  count = steps * 6;
const vertices: number[] = [],
  faces: number[] = [];
for (const [y, radius, depth] of sections)
  for (let face = 0; face < 6; face++) {
    const a = (face * Math.PI) / 3,
      b = ((face + 1) * Math.PI) / 3;
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        recess = depth * Math.sin(t * Math.PI * 3) ** 2;
      vertices.push(
        radius * ((1 - t) * Math.cos(a) + t * Math.cos(b)) - recess * Math.cos((a + b) / 2),
        y,
        radius * ((1 - t) * Math.sin(a) + t * Math.sin(b)) - recess * Math.sin((a + b) / 2),
      );
    }
  }
for (let ring = 0; ring < sections.length - 1; ring++)
  for (let j = 0; j < count; j++) {
    const a = ring * count + j,
      b = ring * count + ((j + 1) % count);
    faces.push(a, a + count, b, b, a + count, b + count);
  }
const body = new BufferGeometry();
body.setAttribute("position", new Float32BufferAttribute(vertices, 3));
body.setIndex(faces);
body.computeVertexNormals();
const top = [
  [0, 0.395],
  [0.283, 0.395],
  [0.297, 0.403],
  [0.3, 0.409],
  [0.3, 0.424],
  [0.295, 0.43],
  [0, 0.43],
].map(([r, y]) => new Vector2(r, y));
export function HexagonalSideTable({
  size = HEXAGONAL_SIDE_TABLE_SIZE,
  variant = "default",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  const oakTop = variant === "oak-top";
  return (
    <group
      name="hexagonal-side-table"
      scale={[size[0] / 0.6, size[1] / 0.43, size[2] / 0.5196152423]}
      userData={{ walkCollider: true }}
    >
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.277, 0.257, 0.03, 6, 1, false, Math.PI / 6]} />
        <ToonMaterial color={oakTop ? "#c1bfb6" : "#926e4a"} />
      </mesh>
      <mesh name="coved-hexagonal-body" geometry={body} dispose={null} castShadow receiveShadow>
        <ToonMaterial color={oakTop ? "#e2e1d9" : "#bd986c"} />
      </mesh>
      <mesh name="hex-table-top" castShadow receiveShadow>
        <latheGeometry args={[top, 6, Math.PI / 6]} />
        <ToonMaterial color={oakTop ? "#c6a579" : "#f0efe7"} />
        <Outlines color={oakTop ? "#94795b" : "#b4b0a3"} thickness={0.0015} screenspace={false} />
      </mesh>
    </group>
  );
}
