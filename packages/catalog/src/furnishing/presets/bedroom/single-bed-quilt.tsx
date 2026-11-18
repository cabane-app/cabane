import { ToonMaterial } from "@cabane/engine";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { linenWeaveTexture } from "../construction/linen-weave-texture";

// Every layer follows the same mattress shoulders. The stitched channels
// compress the batting and soften at the edge where the quilt hangs free.
function quiltLayer(back: number, front: number, throwLayer: boolean) {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rows = throwLayer ? 12 : 40,
    columns = 32;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows,
      z = back + (front - back) * v;
    for (let column = 0; column <= columns; column++) {
      const u = (column / columns) * 2 - 1;
      const side = Math.max(0, (Math.abs(u) - 0.875) / 0.125);
      const foot = Math.max(0, (z - 1.005) / 0.037);
      const x =
        Math.sign(u) *
        (Math.min(Math.abs(u) / 0.875, 1) * 0.451 + 0.036 * Math.sin((side * Math.PI) / 2));
      const channels = Math.sin((column * Math.PI) / 4) ** 2 * Math.cos(z * 14 + u) ** 2;
      const crown = 0.035 * (1 - u * u) + 0.012 * channels + 0.005 * Math.cos(z * 13 + u * 9);
      const tuckedHead = Math.max(0, 1 - (z + 0.5) / 0.09);
      const y =
        0.564 +
        crown -
        (0.03 + crown) * tuckedHead ** 2 -
        (0.14 * (1 - Math.cos((side * Math.PI) / 2)) + 0.07 * foot ** 2) +
        (throwLayer ? 0.004 + 0.012 * Math.sin(v * Math.PI) ** 2 : 0);
      positions.push(x, y, z);
      uvs.push((x + 0.5) * 4, z * 4);
      const tone = throwLayer
        ? [1, 2, 10, 11].includes(row)
          ? 0.77
          : 1
        : column % 4 === 0
          ? 0.94
          : 1;
      colors.push(tone, tone, tone);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const quilt = quiltLayer(-0.5, 1.042, false),
  throwCloth = quiltLayer(0.57, 0.92, true);

export function SingleBedQuilt({ color, throwColor }: { color: string; throwColor: string }) {
  return (
    <>
      <mesh name="single-bed-duvet" geometry={quilt} castShadow receiveShadow>
        <ToonMaterial color={color} vertexColors map={linenWeaveTexture} side={DoubleSide} />
      </mesh>
      <mesh name="single-bed-folded-throw" geometry={throwCloth} castShadow receiveShadow>
        <ToonMaterial color={throwColor} vertexColors map={linenWeaveTexture} side={DoubleSide} />
      </mesh>
    </>
  );
}
