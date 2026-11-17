import { ToonMaterial } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { useEffect, useMemo } from "react";

/** Flat warp bundles spread from each bound end, sharing one quiet surface. */
export function RugSelvedge({ color }: { color: string }) {
  const fringe = useMemo(() => {
    const p: number[] = [],
      indices: number[] = [];
    for (const end of [-1, 1])
      for (let i = 0; i < 68; i++) {
        const x = (i - 33.5) * 0.0285,
          length = 0.031 + 0.005 * Math.cos(i * 2.1),
          splay = 0.003 * Math.sin(i * 1.3);
        const a = p.length / 3;
        p.push(
          x - 0.009,
          0.008,
          end * 1.461,
          x + 0.009,
          0.008,
          end * 1.461,
          x - 0.011 + splay,
          0.003,
          end * (1.464 + length),
          x + 0.009 + splay,
          0.003,
          end * (1.464 + length),
          x + splay,
          0.005,
          end * (1.464 + length - 0.002),
        );
        const face = [0, 4, 1, 0, 2, 4, 1, 4, 3];
        indices.push(...(end === 1 ? face : face.reverse()).map((j) => j + a));
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => fringe.dispose(), [fringe]);
  return (
    <mesh name="rug-warp-ends" geometry={fringe} receiveShadow>
      <ToonMaterial color={color} />
    </mesh>
  );
}
