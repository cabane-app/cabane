import { DoubleSide, BufferGeometry, Float32BufferAttribute } from "three";
import { ToonMaterial } from "@cabane/engine";

// Broad willow ribbons cross alternately over and under their neighbours.
// Leave the grip clear so the recessed lining shows through the weave.
function basketFace() {
  const positions: number[] = [],
    shades: number[] = [],
    indices: number[] = [];
  const columns = 11,
    rows = 7;
  function strand(horizontal: boolean, lane: number, count: number) {
    const lanes = horizontal ? rows : columns;
    const center = (lane + 0.5) / lanes - 0.5;
    const shade = horizontal ? 0.9 + 0.07 * (lane % 3) : 0.76 + 0.04 * (lane % 3);
    for (let cell = 0; cell < count; cell++) {
      const column = horizontal ? cell : lane;
      const row = horizontal ? lane : cell;
      if (row === 5 && column >= 4 && column <= 6) continue;
      const start = positions.length / 3;
      for (let step = 0; step <= 2; step++) {
        const t = (cell + step / 2) / count - 0.5;
        const wave = Math.sin((cell + step / 2 + lane) * Math.PI) * (horizontal ? 1 : -1);
        for (const side of [-1, 1]) {
          const edge = center + (side * 0.44) / lanes;
          positions.push(horizontal ? t : edge, horizontal ? edge : t, 0.003 + wave * 0.002);
          shades.push(shade, shade, shade);
        }
      }
      for (const i of [0, 2]) {
        const a = start + i;
        if (horizontal) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  for (let row = 0; row < rows; row++) strand(true, row, columns);
  for (let column = 0; column < columns; column++) strand(false, column, rows);
  const face = new BufferGeometry();
  face.setAttribute("position", new Float32BufferAttribute(positions, 3));
  face.setAttribute("color", new Float32BufferAttribute(shades, 3));
  face.setIndex(indices);
  face.computeVertexNormals();
  return face;
}
const weave = basketFace();

export function BasketFront({
  width,
  height,
  color,
  position,
}: {
  width: number;
  height: number;
  color: string;
  position: [number, number, number];
}) {
  return (
    <mesh geometry={weave} scale={[width, height, 1]} position={position} receiveShadow>
      <ToonMaterial color={color} vertexColors side={DoubleSide} />
    </mesh>
  );
}
