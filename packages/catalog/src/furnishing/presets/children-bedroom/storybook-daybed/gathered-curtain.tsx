import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { ToonMaterial } from "@cabane/engine";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { archPoint, headRibs } from "./timber";

// Two wings wrap over both ribs, pinch at the top of the mattress and flare at the hem.
function hoodWing(side: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rows = 20,
    columns = 24;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns;
      const gather = Math.exp(-(((v - 0.75) / 0.135) ** 2));
      const wave = Math.cos(u * Math.PI * 8);
      const zSpan = 0.5 * (1 - 0.76 * gather);
      const z = -0.855 + (u - 0.5) * zSpan - 0.085 * gather;
      const crown = headRibs[0].crown + u * (headRibs[1].crown - headRibs[0].crown);
      const top = archPoint(
        (1 - Math.min(1, v / 0.54)) * (1.12 - 0.12 * Math.sin(Math.PI * u)),
        crown,
      );
      const drop = Math.max(0, (v - 0.54) / 0.46);
      const sag = 0.085 * Math.sin(Math.PI * u) * (1 - gather);
      const ripple = 0.019 * wave * (1 - 0.75 * gather);
      const x = side * (top.x + 0.014 + ripple + 0.013 * drop);
      const y = top.y + 0.026 - drop * (0.53 - 0.024 * wave) - sag;
      positions.push(x, y, z);
      uvs.push(u * 2, v * 4);
      const tone = row === 0 || row === rows || col === columns ? 0.81 : 0.96 + wave * 0.04;
      colors.push(tone, tone, tone);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const wings = [-1, 1].map(hoodWing);
export function GatheredCurtains({ color }: { color: string }) {
  return (
    <>
      {wings.map((geometry, i) => (
        <mesh key={i} name="gathered-petal-hood" geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={color} side={DoubleSide} map={linenWeaveTexture} vertexColors />
        </mesh>
      ))}
    </>
  );
}
