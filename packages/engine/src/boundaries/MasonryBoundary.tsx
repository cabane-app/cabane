import { useEffect, useMemo } from "react";
import { Color } from "three";
import { ToonMaterial } from "../rendering";
import type { BoundaryDimensions } from "./BoundaryBeam";
import { masonryGeometry } from "./masonry-geometry";
import type { MasonryMiters } from "./masonry-miters";
import { useScannedFinish } from "../scanned-finishes";

// Keep the specified limestone colors as the photograph's mean tint.
const mineral = new Color("#dbcbb1");
const mineralBalance = new Color(1 / mineral.r, 1 / mineral.g, 1 / mineral.b);

export function MasonryBoundary({
  length,
  height,
  width,
  miters,
}: BoundaryDimensions & { miters?: MasonryMiters | undefined }) {
  const stone = useScannedFinish("travertine", "grounds");
  const { from, to } = miters ?? {};
  const geometry = useMemo(
    () => masonryGeometry({ length, height, width }, { from, to }),
    [length, height, width, from, to],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      name="coursed-masonry"
      userData={{ thumbnailPending: stone === null }}
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <ToonMaterial
        key={stone ? "mineral" : "solid"}
        color={stone ? mineralBalance : "white"}
        map={stone ?? null}
        vertexColors
      />
    </mesh>
  );
}
