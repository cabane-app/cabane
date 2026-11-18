import { ToonMaterial } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { splitCane } from "./shade-finishes";

const strips = 26;
const rows = 16;

/** Two crossing courses of flat palm strips spiral outwards from the crown. */
function createPlaits(hand: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pitch = (2 * Math.PI) / strips;
  for (let strip = 0; strip < strips; strip++) {
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const radius = 0.061 + 0.359 * t;
      const angle = pitch * (strip + hand * 2 * t);
      const y = -0.386 - 0.182 * (1 - Math.cos((t * Math.PI) / 2));
      // At each crossing one tape rides above its neighbor, alternating down the row.
      const lift = hand * 0.0027 * Math.cos(4 * Math.PI * t);
      for (let edge = -1; edge <= 1; edge++) {
        const a = angle + edge * pitch * 0.21;
        positions.push(
          radius * Math.sin(a),
          y + lift + (edge === 0 ? 0.0018 : 0),
          radius * Math.cos(a),
        );
        uvs.push(strip / strips + edge / (2 * strips), t);
      }
      if (row < rows) {
        const i = start + row * 3;
        for (const j of [i, i + 1]) indices.push(j, j + 3, j + 1, j + 1, j + 3, j + 4);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function PlaitedShade({ hand, color }: { readonly hand: number; readonly color: string }) {
  const geometry = useMemo(() => createPlaits(hand), [hand]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <ToonMaterial color={color} map={splitCane} side={2} />
    </mesh>
  );
}
