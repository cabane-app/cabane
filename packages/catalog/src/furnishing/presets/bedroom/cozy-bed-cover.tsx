import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { ToonMaterial } from "@cabane/engine";

/** Closed, softly rippled cloth, with real thickness and side/foot drapes. */
export function CozyBedCover({
  name,
  back,
  front,
  lift,
  thickness,
  color,
  mattressWidth = 1.6,
  mattressFront = 1.035,
  plush = false,
  soft = false,
}: {
  name: string;
  back: number;
  front: number;
  lift: number;
  thickness: number;
  color: string;
  mattressWidth?: number;
  mattressFront?: number;
  plush?: boolean;
  soft?: boolean;
}) {
  const geometry = useMemo(() => {
    const columns = 32;
    const rows = 24;
    const layerVertices = (columns + 1) * (rows + 1);
    const positions: number[] = [];
    const indices: number[] = [];
    const sideEdge = mattressWidth / 2 + 0.006;
    const footEdge = mattressFront + 0.006;
    for (let layer = 0; layer < 2; layer++) {
      for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        const foot = Math.max(0, (v - 0.875) / 0.125);
        const z =
          back +
          (footEdge - back) * Math.min(v / 0.875, 1) +
          (front - footEdge) * Math.sin((foot * Math.PI) / 2);
        for (let column = 0; column <= columns; column++) {
          const u = (column / columns) * 2 - 1;
          const side = Math.max(0, (Math.abs(u) - 0.75) / 0.25);
          // Start each rounded drop outside the mattress, including its underside.
          const x =
            Math.sign(u) *
            (sideEdge * Math.min(Math.abs(u) / 0.75, 1) + 0.032 * Math.sin((side * Math.PI) / 2));
          const folds = soft
            ? 0.003 * Math.sin(u * 10 + z * 5)
            : 0.007 * Math.sin(u * 19 + z * 5) + 0.004 * Math.cos(z * 24 - u * 7);
          const pile = plush ? 0.004 * Math.sin(u * 67 + z * 39) ** 2 : 0;
          // Shared side drops and layer lifts keep the exposed faces separated.
          const crown = soft ? 0.045 * (1 - u * u) : 0;
          const drop = 0.19 * (1 - Math.cos((Math.max(side, foot) * Math.PI) / 2));
          const y = 0.605 + lift + crown - drop + folds + pile;
          positions.push(x, y - layer * thickness, z);
        }
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
        const o = layerVertices;
        indices.push(a + o, b + o, c + o, b + o, d + o, c + o);
      }
    }
    const rim = [
      ...Array.from({ length: columns + 1 }, (_, i) => i),
      ...Array.from({ length: rows }, (_, i) => (i + 1) * (columns + 1) + columns),
      ...Array.from({ length: columns }, (_, i) => rows * (columns + 1) + columns - i - 1),
      ...Array.from({ length: rows - 1 }, (_, i) => (rows - i - 1) * (columns + 1)),
    ];
    rim.forEach((a, index) => {
      const b = rim[(index + 1) % rim.length];
      indices.push(a, b, a + layerVertices, b, b + layerVertices, a + layerVertices);
    });
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [back, front, lift, thickness, mattressWidth, mattressFront, plush, soft]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name={name} geometry={geometry} dispose={null} castShadow receiveShadow>
      <ToonMaterial color={color} />
    </mesh>
  );
}
