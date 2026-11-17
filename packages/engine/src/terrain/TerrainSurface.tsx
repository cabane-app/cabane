import { createContext, useContext, useMemo } from "react";
import type { FloorSpec } from "../types";
import type { TerrainSettings } from "./terrain-settings";
import { createTerrainSurface, type TerrainSurface } from "./terrain-surface";

export const TerrainSurfaceContext = createContext<TerrainSurface>(null);
export const useTerrainSurface = () => useContext(TerrainSurfaceContext);

/** Arrange recomposes floor specs on item edits. Preserve terrain meshes and their contact receivers
 * when the cutouts, bounds and four heights used by offsetAt still describe the same surface. */
export function useSceneTerrain(
  settings: TerrainSettings | undefined,
  floors: readonly FloorSpec[],
) {
  const { surface, shape } = useMemo(() => {
    const surface = createTerrainSurface(settings, floors);
    return { surface, shape: surface && JSON.stringify([settings, surface]) };
  }, [settings, floors]);
  // The derived shape includes the corner heights captured by the sampler.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => surface, [shape]);
}
