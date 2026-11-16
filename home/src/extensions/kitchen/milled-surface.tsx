import type { KitchenVector3 } from "./kitchen-finish";

export type Face = readonly [KitchenVector3, KitchenVector3, KitchenVector3, KitchenVector3];

/** Crisp planes for routed and milled profiles, with a separate normal on each facet. */
export function MilledSurface({ faces }: { readonly faces: readonly Face[] }) {
  const vertices: number[] = [];
  const normals: number[] = [];
  for (const [a, b, c, d] of faces) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    const nx = u[1] * v[2] - u[2] * v[1],
      ny = u[2] * v[0] - u[0] * v[2],
      nz = u[0] * v[1] - u[1] * v[0];
    const length = Math.hypot(nx, ny, nz);
    for (const p of [a, b, c, a, c, d]) {
      vertices.push(...p);
      normals.push(nx / length, ny / length, nz / length);
    }
  }
  return (
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[new Float32Array(vertices), 3]} />
      <bufferAttribute attach="attributes-normal" args={[new Float32Array(normals), 3]} />
    </bufferGeometry>
  );
}
