import { useEffect, useMemo } from "react";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { StairFlight } from "../flight-geometry";
import {
  OPEN_TREAD_THICKNESS,
  StairSurfaceMaterial,
  treadSlabGeometry,
} from "./StairPolygonSurface";

export function StairTreads({ flight, plan }: { flight: StairFlight; plan: boolean }) {
  const { widthMeters, riseMeters, runMeters, stepCount } = flight;
  const finish = plan ? false : "light-oak";
  const geometry = useMemo(() => {
    const rise = riseMeters / stepCount;
    const run = runMeters / stepCount;
    const half = widthMeters / 2;
    const slabs = Array.from({ length: stepCount }, (_, index) => {
      const front = run * index - 0.005,
        back = run * (index + 1) + 0.005;
      const baseY = rise * (index + 1) - OPEN_TREAD_THICKNESS;
      const slab = treadSlabGeometry(
        [
          [-half, front],
          [half, front],
          [half, back],
          [-half, back],
        ],
        baseY,
        OPEN_TREAD_THICKNESS,
        finish,
      );
      // Keep the existing mesh's quarter-turn; its local Z is world height.
      const positions = slab.getAttribute("position");
      for (let i = 0; i < positions.count; ++i) positions.setZ(i, positions.getZ(i) + baseY);
      return slab;
    });
    const merged = mergeGeometries(slabs);
    slabs.forEach((slab) => slab.dispose());
    merged.userData.preservePlanarFaces = true;
    return merged;
  }, [widthMeters, riseMeters, runMeters, stepCount, finish]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      name="stair-open-treads"
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <StairSurfaceMaterial finish={finish} />
    </mesh>
  );
}
