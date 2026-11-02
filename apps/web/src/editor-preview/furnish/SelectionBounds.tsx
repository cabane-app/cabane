import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { noPlanRaycast } from "../construct/PlanDrawing";
import type { SelectionBoxGeometry } from "./editor-state";

/** Screen-space strokes keep selection legible at every camera distance. */
export function SelectionBounds({ center, size }: SelectionBoxGeometry) {
  const [width, height, depth] = size;
  const { edges, corners } = useMemo(() => {
    const half = [width, height, depth].map((value) => value / 2 + 0.035);
    const edges: [number, number, number][] = [];
    const corners: [number, number, number][] = [];
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1]) {
          const corner: [number, number, number] = [x * half[0], y * half[1], z * half[2]];
          for (let axis = 0; axis < 3; axis++) {
            const end: [number, number, number] = [...corner];
            if (corner[axis] < 0) {
              end[axis] *= -1;
              edges.push(corner, end);
            }
            const tick: [number, number, number] = [...corner];
            tick[axis] -= Math.sign(corner[axis]) * Math.min(half[axis] * 0.4, 0.2);
            corners.push(corner, tick);
          }
        }
    return { edges, corners };
  }, [width, height, depth]);
  const overlay = {
    segments: true,
    raycast: noPlanRaycast,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
  } as const;
  return (
    <group name="arrange-selection-bounds" position={center}>
      <Line
        {...overlay}
        points={edges}
        color="#fff8ef"
        lineWidth={4.5}
        opacity={0.9}
        renderOrder={31}
      />
      <Line
        {...overlay}
        points={edges}
        color="#354d41"
        lineWidth={1.75}
        opacity={0.9}
        renderOrder={32}
      />
      <Line {...overlay} points={corners} color="#354d41" lineWidth={3} renderOrder={33} />
    </group>
  );
}
