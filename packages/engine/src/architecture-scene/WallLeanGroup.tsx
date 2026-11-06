import { useMemo, type ReactNode } from "react";

import { wallLeanMatrix } from "../architecture-geometry/wall-lean";

import type { FloorSpec, WallSpec } from "../types";

/** Shears its children with a leaning wall; a plain wrapper for an upright one. */
export function WallLeanGroup({
  wall,
  floor,
  children,
}: {
  wall: WallSpec;
  floor: FloorSpec;
  children: ReactNode;
}) {
  const matrix = useMemo(() => wallLeanMatrix(wall, floor), [wall, floor]);
  if (!matrix) return <>{children}</>;
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {children}
    </group>
  );
}
